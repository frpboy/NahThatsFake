import { randomUUID } from 'crypto';
import type { Bot } from 'grammy';
import type { SupabaseClient } from '@supabase/supabase-js';

// Structural types so the bot package does not need express as a dependency.
interface WebhookRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}
interface WebhookResponse {
  status(code: number): { end(): void };
}

export interface WebhookDeps {
  bot: Bot;
  supabase: SupabaseClient;
  secretToken?: string;
  /** How long a 'processing' marker is trusted before a retry may take over (crash recovery). */
  takeoverAfterMs?: number;
}

const DEFAULT_TAKEOVER_MS = 5 * 60 * 1000;

type UpdateRow = { update_id: number; status: string; started_at: string };

/**
 * Telegram webhook handler for the Vercel serverless deployment.
 *
 * Delivery semantics:
 * - Requires TELEGRAM_WEBHOOK_SECRET; fails closed (401) when unset or wrong.
 * - Calls bot.init() once per instance (grammy requires it before handleUpdate).
 * - Idempotency via processed_updates (update_id PK, status processing|done|failed):
 *   - first delivery inserts 'processing' and handles the update
 *   - success -> status 'done', 200; later duplicates are acked and skipped
 *   - handler error -> status 'failed', 500 so Telegram retries; a retry seeing
 *     'failed' reprocesses (side effects are guarded by credit_charges in
 *     consumeCredit; a repeated provider call / duplicate reply is still
 *     possible after a partial failure - same residual risk as a long-poll
 *     crash mid-handler)
 *   - conflict on 'processing': fresh (< takeoverAfterMs) means another
 *     invocation is in flight -> ack and skip; stale means its invocation died
 *     -> take over and reprocess
 *   - dedupe-table errors -> 500 so Telegram retries instead of silent loss
 */
export function createTelegramWebhookHandler(deps: WebhookDeps) {
  const { bot, supabase, secretToken } = deps;
  const takeoverAfterMs = deps.takeoverAfterMs ?? DEFAULT_TAKEOVER_MS;
  let initPromise: Promise<unknown> | null = null;
  const ensureInit = () =>
    (initPromise ??= bot.init().catch((e) => {
      // Do not cache a rejected init: a transient getMe failure must not
      // poison every later delivery on this warm instance.
      initPromise = null;
      throw e;
    }));

  async function process(updateId: number, update: unknown, res: WebhookResponse, claimToken: string): Promise<void> {
    try {
      await ensureInit();
      await bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
      // Fence by claim token: if our claim was taken over (stale), we must not
      // overwrite the successor's state.
      const { error: doneError } = await supabase
        .from('processed_updates')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('update_id', updateId)
        .eq('claim_token', claimToken);
      if (doneError) {
        // Work succeeded but the dedupe record could not be confirmed; ask
        // Telegram to retry so the state converges (credit ledger prevents a
        // double charge on that retry).
        console.error('[webhook] failed to mark update done:', doneError);
        res.status(500).end();
        return;
      }
      res.status(200).end();
    } catch (e) {
      console.error('[webhook] update processing failed:', e);
      await supabase
        .from('processed_updates')
        .update({ status: 'failed', finished_at: new Date().toISOString() })
        .eq('update_id', updateId)
        .eq('claim_token', claimToken);
      res.status(500).end();
    }
  }

  return async function telegramWebhookHandler(req: WebhookRequest, res: WebhookResponse): Promise<void> {
    // Fail closed: without the shared secret there is no way to authenticate Telegram.
    const header = req.headers['x-telegram-bot-api-secret-token'];
    if (!secretToken || header !== secretToken) {
      res.status(401).end();
      return;
    }

    // Validate the update shape before any side effect: an object with a
    // safe-integer update_id. Anything else is acked and ignored.
    const update = req.body as { update_id?: unknown } | undefined | null;
    if (!update || typeof update !== 'object' || !Number.isSafeInteger(update.update_id) || (update.update_id as number) < 0) {
      res.status(200).end();
      return;
    }
    const updateId = update.update_id as number;

    const claimToken = randomUUID();
    const { error: insertError } = await supabase
      .from('processed_updates')
      .insert({ update_id: updateId, status: 'processing', started_at: new Date().toISOString(), claim_token: claimToken });

    if (!insertError) {
      await process(updateId, update, res, claimToken);
      return;
    }

    if ((insertError as { code?: string }).code !== '23505') {
      console.error('[webhook] processed_updates insert failed:', insertError);
      res.status(500).end();
      return;
    }

    // Duplicate delivery: decide from the recorded state.
    const { data: existing, error: selectError } = await supabase
      .from('processed_updates')
      .select('update_id, status, started_at')
      .eq('update_id', updateId)
      .single();

    if (selectError || !existing) {
      console.error('[webhook] processed_updates lookup failed:', selectError);
      res.status(500).end();
      return;
    }

    const row = existing as UpdateRow;
    if (row.status === 'done') {
      res.status(200).end();
      return;
    }

    const stale = Date.now() - new Date(row.started_at).getTime() > takeoverAfterMs;
    if (row.status === 'processing' && !stale) {
      // Another invocation is actively handling this update. Do NOT ack: if
      // that worker dies after we ack, Telegram would have no failed delivery
      // to retry and the update would be lost. A 500 makes Telegram retry;
      // the retry then sees 'done' (no reprocessing) or takes over the stale
      // claim.
      res.status(500).end();
      return;
    }

    // 'failed' (Telegram retry) or stale 'processing' (crashed invocation):
    // claim by matching the exact observed state. If a concurrent claimant
    // won first, 0 rows match - that is a lost race, not an error; the
    // winner's delivery governs, so ack and skip.
    const newClaimToken = randomUUID();
    const { data: claimed, error: claimError } = await supabase
      .from('processed_updates')
      .update({ status: 'processing', started_at: new Date().toISOString(), claim_token: newClaimToken })
      .eq('update_id', updateId)
      .eq('status', row.status)
      .eq('started_at', row.started_at)
      .select('update_id');

    if (claimError) {
      console.error('[webhook] failed to claim update for reprocessing:', claimError);
      res.status(500).end();
      return;
    }
    if (!claimed || claimed.length === 0) {
      res.status(200).end();
      return;
    }

    await process(updateId, update, res, newClaimToken);
  };
}

// Default handler bound to the real bot + Supabase client (used by tma/server.js).
// Lazy so that importing this module (e.g. in tests) has no side effects and the
// bot/env config is only required when the first webhook request arrives.
let defaultHandler: ReturnType<typeof createTelegramWebhookHandler> | null = null;
export function telegramWebhookHandler(req: WebhookRequest, res: WebhookResponse): Promise<void> {
  // Authenticate BEFORE loading the bot/env modules: an unauthenticated
  // request must not trigger any module-level effect.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (!secret || header !== secret) {
    res.status(401).end();
    return Promise.resolve();
  }
  if (!defaultHandler) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bot } = require('./bot');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('./supabase');
    defaultHandler = createTelegramWebhookHandler({
      bot,
      supabase,
      secretToken: secret,
    });
  }
  return defaultHandler(req, res);
}
