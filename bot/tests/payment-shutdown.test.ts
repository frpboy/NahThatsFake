import assert from 'node:assert/strict';
import type { Context } from 'grammy';

process.env.BOT_TOKEN ||= '123456:test-bot-token';
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

async function run(): Promise<void> {
  const { handlePreCheckout } = await import('../src/handlers/payment');
  let answer: { ok: boolean; errorMessage?: string } | undefined;

  const ctx = {
    answerPreCheckoutQuery: async (ok: boolean, errorMessage?: string) => {
      answer = { ok, errorMessage };
    }
  } as unknown as Context;

  await handlePreCheckout(ctx);

  assert.deepEqual(answer, {
    ok: false,
    errorMessage: 'Purchases are no longer available.'
  });

  console.log('Pending Telegram Stars pre-checkout is rejected after purchase shutdown');
}

void run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
