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
}

/**
 * Telegram webhook handler for the Vercel serverless deployment.
 *
 * Delivery semantics (preserves long-polling behaviour):
 * - Telegram retries an update until it gets a non-5xx response (up to ~24h).
 * - We insert update_id into processed_updates first; a unique-violation means
 *   a retry/concurrent duplicate -> ack 200 without reprocessing.
 * - If processing throws, we delete the marker and return 500 so Telegram
 *   retries later (at-least-once, same as long polling after a crash).
 * - If the invocation is killed mid-processing, the marker remains and the
 *   retried delivery is acked without reprocessing (at-most-once for that
 *   crash window) - matches a long-polling crash between offset advance and
 *   reply, so no new failure mode is introduced.
 */
export function createTelegramWebhookHandler(deps: WebhookDeps) {
  const { bot, supabase, secretToken } = deps;

  return async function telegramWebhookHandler(req: WebhookRequest, res: WebhookResponse): Promise<void> {
    // Validate the secret token configured via setWebhook(secret_token=...).
    if (secretToken) {
      const header = req.headers['x-telegram-bot-api-secret-token'];
      if (header !== secretToken) {
        res.status(401).end();
        return;
      }
    } else {
      console.warn('[webhook] TELEGRAM_WEBHOOK_SECRET is not set; skipping secret-token validation');
    }

    const update = req.body as { update_id?: unknown } | undefined | null;
    if (!update || typeof update.update_id !== 'number') {
      // Not a Telegram update (probe, health check, malformed body): ack and ignore.
      res.status(200).end();
      return;
    }
    const updateId = update.update_id;

    // Idempotency gate: first delivery inserts, retries conflict.
    const { error: insertError } = await supabase
      .from('processed_updates')
      .insert({ update_id: updateId });

    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        // Duplicate delivery: ack without reprocessing.
        res.status(200).end();
        return;
      }
      // Transient DB failure: 500 so Telegram retries instead of silently dropping.
      console.error('[webhook] processed_updates insert failed:', insertError);
      res.status(500).end();
      return;
    }

    try {
      await bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
      res.status(200).end();
    } catch (e) {
      console.error('[webhook] update processing failed:', e);
      // Allow Telegram's retry to reprocess: remove the dedupe marker.
      const { error: deleteError } = await supabase
        .from('processed_updates')
        .delete()
        .eq('update_id', updateId);
      if (deleteError) {
        console.error('[webhook] failed to clear dedupe marker; retry will be skipped:', deleteError);
      }
      res.status(500).end();
    }
  };
}

// Default handler bound to the real bot + Supabase client (used by tma/server.js).
// Lazy so that importing this module (e.g. in tests) has no side effects and the
// bot/env config is only required when the first webhook request arrives.
let defaultHandler: ReturnType<typeof createTelegramWebhookHandler> | null = null;
export function telegramWebhookHandler(req: WebhookRequest, res: WebhookResponse): Promise<void> {
  if (!defaultHandler) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bot } = require('./bot');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { supabase } = require('./supabase');
    defaultHandler = createTelegramWebhookHandler({
      bot,
      supabase,
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
    });
  }
  return defaultHandler(req, res);
}
