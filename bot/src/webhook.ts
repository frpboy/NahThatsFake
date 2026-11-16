import { randomUUID } from 'crypto';
import type { Bot } from 'grammy';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AmbiguousOperationError, ClaimLostError, type NtfDeliveryContext } from './errors';

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
  /** How long a 'processing' marker is trusted before a retry may take over. */
  takeoverAfterMs?: number;
  /** Abort signal fires after this long; every instrumented external call carries it. */
  watchdogMs?: number;
  /** How long to wait for aborted work to unwind before responding. */
  settleGraceMs?: number;
}

// Takeover TTL must exceed the longest possible LIVE worker with margin:
// watchdog (240s) + settle grace (35s) = 275s worst-case live work, so a
// worker can never legitimately be alive at 10 minutes. Takeover therefore
// only ever reclaims genuinely dead invocations.
const DEFAULT_TAKEOVER_MS = 10 * 60 * 1000;
const DEFAULT_WATCHDOG_MS = 240 * 1000;
// Every DB call self-bounds at 30s (supabase client fetch timeout) and every
// instrumented network call carries the abort signal, so aborted work unwinds
// well within 35s.
const DEFAULT_SETTLE_GRACE_MS = 35 * 1000;

type UpdateRow = { update_id: number; status: string; started_at: string; reply_phase: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Telegram webhook handler for the Vercel serverless deployment.
 *
 * Delivery contract (the uniform response rule):
 * - 200 is returned ONLY when a durable terminal state is confirmed: we wrote
 *   'done' ourselves (fenced write matched our row), we read an existing
 *   'done'/'ambiguous' row, or the update stopped as ambiguous (acked, no
 *   automatic replay of uncertain effects). Invalid input is acked without
 *   processing.
 * - 500 everywhere else: Telegram keeps a retry path and the system converges
 *   through retries. No branch acks unconfirmed work.
 *
 * Per-effect durable phases make reprocessing safe:
 * - credit outcome: recorded once in credit_charges by consume_credit_atomic
 *   (including zero-cost outcomes), replayed - never re-evaluated - on retry.
 * - scan result: a 'pending' check_cache row precedes the provider call; a
 *   later delivery seeing a live pending row stops as ambiguous instead of
 *   re-calling a paid provider with uncertain spend. Completed results are
 *   reused from the cache.
 * - result reply: reply_phase 'replying' precedes the send, 'replied'
 *   confirms it. A later delivery seeing 'replying' stops as ambiguous
 *   (the reply may have been sent); 'replied' converges to done.
 *
 * Crash recovery: a stale 'processing' row (started_at older than
 * takeoverAfterMs) belongs to a dead invocation and may be re-claimed; the
 * claim is guarded by the exact observed state and must match a row.
 */
export function createTelegramWebhookHandler(deps: WebhookDeps) {
  const { bot, supabase, secretToken } = deps;
  const takeoverAfterMs = deps.takeoverAfterMs ?? DEFAULT_TAKEOVER_MS;
  const watchdogMs = deps.watchdogMs ?? DEFAULT_WATCHDOG_MS;
  const settleGraceMs = deps.settleGraceMs ?? DEFAULT_SETTLE_GRACE_MS;
  let initPromise: Promise<unknown> | null = null;
  const ensureInit = (signal: AbortSignal) => {
    // Do not cache a rejected init: a transient getMe failure must not
    // poison every later delivery on this warm instance.
    initPromise ??= bot.init().catch((e) => {
      initPromise = null;
      throw e;
    });
    return Promise.race([
      initPromise,
      new Promise((_, reject) => {
        if (signal.aborted) reject(new ClaimLostError('aborted during init'));
        signal.addEventListener('abort', () => reject(new ClaimLostError('aborted during init')), { once: true });
      }),
    ]);
  };

  async function process(updateId: number, update: unknown, res: WebhookResponse, claimToken: string): Promise<void> {
    const controller = new AbortController();
    (update as { __ntf?: NtfDeliveryContext }).__ntf = { claimToken, signal: controller.signal };
    const timer = setTimeout(() => controller.abort(), watchdogMs);

    let settled = false;
    const work = (async () => {
      await ensureInit(controller.signal);
      await bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
    })();
    work.catch(() => undefined).finally(() => { settled = true; });

    try {
      await work;
      clearTimeout(timer);
      // Confirm completion durably. The fenced write must match our claim:
      // if it does not, completion is NOT recorded and we must stay retriable.
      const { data: doneRows, error: doneError } = await supabase
        .from('processed_updates')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('update_id', updateId)
        .eq('claim_token', claimToken)
        .select('update_id');
      if (doneError || !doneRows || doneRows.length !== 1) {
        console.error('[webhook] done-write did not confirm (lost claim or store error):', doneError ?? '0 rows');
        res.status(500).end();
        return;
      }
      res.status(200).end();
    } catch (e) {
      clearTimeout(timer);

      if (e instanceof AmbiguousOperationError) {
        // Stop-on-ambiguity: an irreversible effect (paid provider call or the
        // result reply) may already have happened. Never replay it. The
        // delivery is acked; repair is an operator action, not a retry.
        console.error('[webhook] operation stopped as ambiguous:', (e as Error).message);
        await supabase
          .from('processed_updates')
          .update({ status: 'ambiguous', finished_at: new Date().toISOString() })
          .eq('update_id', updateId)
          .eq('claim_token', claimToken);
        res.status(200).end();
        return;
      }

      if (controller.signal.aborted && !settled) {
        // Watchdog fired. The work's external calls all carry the abort signal
        // or a 30s fetch timeout, so it unwinds within the grace period; wait
        // for it before responding so a retry never overlaps a live worker.
        const deadline = Date.now() + settleGraceMs;
        while (!settled && Date.now() < deadline) await sleep(100);
        if (!settled) {
          console.error('[webhook] aborted work did not settle within grace; DB writes remain fenced by claim token');
        }
      }

      const isClaimLoss = e instanceof ClaimLostError;
      if (!isClaimLoss) console.error('[webhook] update processing failed:', e);
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
      .select('update_id, status, started_at, reply_phase')
      .eq('update_id', updateId)
      .single();

    if (selectError || !existing) {
      console.error('[webhook] processed_updates lookup failed:', selectError);
      res.status(500).end();
      return;
    }

    const row = existing as UpdateRow;

    // Terminal states: confirmed durable, safe to ack without effects.
    if (row.status === 'done' || row.status === 'ambiguous') {
      res.status(200).end();
      return;
    }

    // The result reply was confirmed sent; only the done marker is missing.
    if (row.reply_phase === 'replied') {
      const { data: closed } = await supabase
        .from('processed_updates')
        .update({ status: 'done', finished_at: new Date().toISOString() })
        .eq('update_id', updateId)
        .eq('status', row.status)
        .eq('started_at', row.started_at)
        .select('update_id');
      res.status(closed && closed.length === 1 ? 200 : 500).end();
      return;
    }

    // The result reply may or may not have been sent. Never replay it: stop
    // the operation as ambiguous (ack, no effects).
    if (row.reply_phase === 'replying') {
      await supabase
        .from('processed_updates')
        .update({ status: 'ambiguous', finished_at: new Date().toISOString() })
        .eq('update_id', updateId)
        .eq('status', row.status)
        .eq('started_at', row.started_at);
      res.status(200).end();
      return;
    }

    const stale = Date.now() - new Date(row.started_at).getTime() > takeoverAfterMs;
    if (row.status === 'processing' && !stale) {
      // Another invocation is actively handling this update. Do NOT ack: if
      // that worker dies after we ack, Telegram would have no failed delivery
      // to retry and the update would be lost. A 500 makes Telegram retry;
      // the retry then sees a terminal state or takes over the stale claim.
      res.status(500).end();
      return;
    }

    // 'failed' (Telegram retry) or stale 'processing' (dead invocation):
    // claim by matching the exact observed state. If a concurrent claimant
    // won first, 0 rows match. That is NOT ackable: the winner's completion
    // is unconfirmed, and a 200 here could strand the update if the winner
    // dies. Stay retriable; the next delivery converges.
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
    if (!claimed || claimed.length !== 1) {
      console.error('[webhook] takeover claim matched no row (concurrent claimant won); staying retriable');
      res.status(500).end();
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
