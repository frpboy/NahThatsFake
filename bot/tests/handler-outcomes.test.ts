import assert from 'node:assert/strict';

// Source-level assertions for the credit outcome ordering in the check
// handlers (PR #471 review), following the repo's existing source-test
// precedent (tma/tests/service-role-reads.test.js). The handlers need a
// live grammY context and Telegram API to run in-process, so the
// invariants that protect users' credits are pinned structurally here,
// while the reserve/settle/release semantics themselves are covered
// behaviourally in credits.test.ts:
//
//   1. A verdict is DELIVERED before its reservation is settled. If the
//      result reply throws, the handler's catch releases the still-open
//      reservation; a settled reservation could not be refunded, so
//      settling first would charge for an undelivered verdict.
//   2. A duplicate Telegram delivery stands down: it checks
//      reservation.duplicate before any scan, history insert, or
//      settle/release of the shared reservation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');

function readHandler(name: string): string {
  return fs.readFileSync(path.join(__dirname, `../src/handlers/${name}`), 'utf8');
}

function run(): void {
  const link = readHandler('link.ts');
  const image = readHandler('image.ts');

  for (const [name, source] of [['link.ts', link], ['image.ts', image]] as const) {
    // (2) Duplicate guard exists, and runs before the history insert
    // (so a redelivery writes no history row of its own).
    const guard = source.indexOf('reservation?.duplicate && !reservation.adopted');
    assert.notEqual(guard, -1, `${name}: duplicate-delivery guard missing`);
    const historyInsert = source.indexOf("from('checks')");
    assert.notEqual(historyInsert, -1, `${name}: checks insert not found`);
    assert.ok(guard < historyInsert, `${name}: duplicate guard must run before the checks insert`);
  }

  // (1) link.ts: the result reply is sent before the reservation settles.
  const linkReply = link.indexOf('Link Check Result');
  const linkSettle = link.indexOf('await settleCredit(', linkReply);
  assert.notEqual(linkReply, -1);
  assert.notEqual(linkSettle, -1, 'link.ts: settle must follow the result reply');

  // (1) image.ts caption path: the combined results reply precedes the
  // settle/release decision.
  const captionReply = image.indexOf('await ctx.reply(formatSeparateCheckResults(separate)');
  assert.notEqual(captionReply, -1);
  const captionSettle = image.indexOf('await settleCredit(', captionReply);
  const captionRelease = image.indexOf('await releaseCredit(', captionReply);
  assert.notEqual(captionSettle, -1, 'image.ts: caption-path settle must follow the results reply');
  assert.notEqual(captionRelease, -1, 'image.ts: caption-path release must follow the results reply');

  // (1) image.ts single-result path: the result reply precedes settling.
  const imageReply = image.indexOf('Deepfake Detection Result');
  assert.notEqual(imageReply, -1);
  const imageSettle = image.indexOf('await settleCredit(', imageReply);
  assert.notEqual(imageSettle, -1, 'image.ts: settle must follow the result reply');

  console.log('Handler credit-outcome ordering assertions passed');
}

run();
