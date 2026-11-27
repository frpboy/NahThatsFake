import assert from 'node:assert/strict';

// Source-level assertions for the bot's command routing architecture,
// following the repo's existing source-test precedent
// (tests/handler-outcomes.test.ts). The bot needs a live grammY context
// and Telegram API to run in-process, so the routing invariants that the
// Feb 2026 build relied on are pinned structurally here:
//
//   1. Every bot.command(...) is registered BEFORE the
//      bot.on('message:text') handler, so commands always win over the
//      generic text fallback. The admin panel advertises a /users
//      command, so a bot.command('users') registration must exist.
//   2. The generic fallback reply ("Send me an image or a link to
//      check...") only fires for text that is not a command: it is
//      guarded by !text.trim().startsWith('/').
//   3. Reply-keyboard button labels (My Account, Premium, Bot Info,
//      Feedback, Support, Open App) are matched inside the text handler
//      before the fallback reply.
//   4. Multi-step flow state (feedback, broadcast, admin reply) is
//      consumed inside the text handler before button routing, so a
//      message that belongs to an in-progress flow is never swallowed
//      by a button branch or the fallback (Feb behaviour).
//   5. ctx.state is initialised before the impersonation middleware
//      assigns ctx.state.actingTelegramUserId. The Feb baseline commit
//      fda5992 added that assignment without the initialisation, which
//      throws "Cannot set properties of undefined" on grammY contexts;
//      current code initialises state first and this pins it.
//   6. The feedback flow: choosing a feedback type sets feedbackState
//      with step 'waiting_message' and prompts "Please describe your
//      ... Send it as a text message."
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');

function readIndex(): string {
  return fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
}

function run(): void {
  const source = readIndex();

  const textHandler = source.indexOf("bot.on('message:text'");
  assert.notEqual(textHandler, -1, 'index.ts: message:text handler not found');
  const text = source.slice(textHandler);

  // (1) Every command registration precedes the text handler, and the
  // panel-advertised /users command exists.
  const commandRe = /bot\.command\('([a-z_]+)'/g;
  const commands: Array<{ name: string; idx: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = commandRe.exec(source)) !== null) {
    commands.push({ name: match[1], idx: match.index });
  }
  assert.ok(commands.length > 0, 'index.ts: no bot.command registrations found');
  for (const cmd of commands) {
    assert.ok(
      cmd.idx < textHandler,
      `index.ts: /${cmd.name} is registered after the message:text handler and could be swallowed by the fallback`
    );
  }
  assert.ok(
    commands.some((c) => c.name === 'users'),
    "index.ts: the admin panel advertises /users but no bot.command('users') registration exists"
  );

  // (2) The fallback reply is guarded against command text.
  const fallback = text.indexOf('Send me an image or a link to check');
  assert.notEqual(fallback, -1, 'index.ts: generic fallback reply not found in text handler');
  const guard = text.indexOf("if (!text.trim().startsWith('/'))");
  assert.notEqual(guard, -1, 'index.ts: fallback guard (!startsWith(\'/\')) missing');
  assert.ok(guard < fallback, 'index.ts: fallback guard must precede the fallback reply');

  // (3) Button labels are routed inside the text handler, before the
  // fallback reply.
  for (const label of ['My Account', 'Premium', 'Bot Info', 'Feedback', 'Support', 'Open App']) {
    const idx = text.indexOf(`text.includes('${label}')`);
    assert.notEqual(idx, -1, `index.ts: button label '${label}' is not routed in the text handler`);
    assert.ok(idx < fallback, `index.ts: button label '${label}' must be routed before the fallback reply`);
  }

  // (4) In-progress flow state is consumed before button routing.
  const firstButton = text.indexOf("text.includes('My Account')");
  assert.notEqual(firstButton, -1);
  for (const stateRead of ['broadcastState.has', 'feedbackState.has', 'replyState.get']) {
    const idx = text.indexOf(stateRead);
    assert.notEqual(idx, -1, `index.ts: ${stateRead} is not consumed in the text handler`);
    assert.ok(idx < firstButton, `index.ts: ${stateRead} must be consumed before button routing`);
  }

  // (5) ctx.state initialisation precedes the impersonation assignment.
  const init = source.indexOf('(ctx as any).state = (ctx as any).state || {};');
  assert.notEqual(init, -1, 'index.ts: ctx.state initialisation missing (fda5992 latent crash)');
  const assign = source.indexOf('(ctx as any).state.actingTelegramUserId =');
  assert.notEqual(assign, -1, 'index.ts: impersonation actingTelegramUserId assignment not found');
  assert.ok(init < assign, 'index.ts: ctx.state must be initialised before the impersonation assignment');

  // (6) Feedback type selection sets the waiting_message state and
  // prompts for a description.
  assert.ok(
    source.includes("feedbackState.set(userId, { step: 'waiting_message', type })"),
    "index.ts: feedback callback must set feedbackState with step 'waiting_message'"
  );
  assert.ok(
    source.includes('Please describe your ${type}. Send it as a text message.'),
    'index.ts: feedback prompt ("Please describe your ...") missing'
  );

  console.log('Command routing assertions passed');
}

run();
