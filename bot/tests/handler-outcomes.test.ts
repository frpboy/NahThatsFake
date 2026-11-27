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
//   3. Every Supabase write on the check path (checks history rows and
//      check_cache rows) captures and logs its result error.
//      supabase-js never throws on a write failure, so a discarded
//      result is a silent failure — an unchecked checks insert hid a
//      broken database trigger that lost every history row for the
//      app's whole life. Logging must not change control flow: the
//      verdict is still delivered when a history write fails.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');

function readHandler(name: string): string {
  return fs.readFileSync(path.join(__dirname, `../src/handlers/${name}`), 'utf8');
}

function readService(name: string): string {
  return fs.readFileSync(path.join(__dirname, `../src/services/${name}`), 'utf8');
}

// (3) Every insert into `table` in `source` must destructure its result
// error (the `const { error... } = await supabase.from(...)` shape), so
// no write on the check path can fail silently again. Reads of the same
// table are ignored: only `.insert(` calls are matched.
function assertWritesChecked(source: string, table: string, label: string): void {
  const needle = `from('${table}').insert(`;
  let idx = source.indexOf(needle);
  assert.notEqual(idx, -1, `${label}: no ${table} write found`);
  while (idx !== -1) {
    const before = source.slice(Math.max(0, idx - 120), idx);
    assert.ok(
      before.includes('const { error'),
      `${label}: ${table} write at offset ${idx} does not capture its result error`
    );
    idx = source.indexOf(needle, idx + needle.length);
  }
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

  // (3) Check-path writes capture and log their errors.
  assertWritesChecked(link, 'checks', 'link.ts');
  assertWritesChecked(link, 'check_cache', 'link.ts');
  assertWritesChecked(image, 'checks', 'image.ts');
  assert.ok(
    link.includes("console.error('Failed to record check history (link):'"),
    'link.ts: history insert failure must be logged'
  );
  assert.ok(
    link.includes("console.error('Failed to save link check to cache:'"),
    'link.ts: cache insert failure must be logged'
  );
  assert.ok(
    image.includes("console.error('Failed to record check history (image):'"),
    'image.ts: image history insert failure must be logged'
  );
  assert.ok(
    image.includes("console.error('Failed to record check history (caption link):'"),
    'image.ts: caption-link history insert failure must be logged'
  );

  // (3) The image path's cache write lives in saveImageCache; its
  // insert result must be checked there too (a try/catch alone cannot
  // see a supabase-js write failure).
  const sightengine = readService('sightengine.ts');
  const saveCache = sightengine.slice(sightengine.indexOf('export async function saveImageCache'));
  assert.ok(
    saveCache.includes("const { error } = await supabase.from('check_cache')"),
    'sightengine.ts: saveImageCache must capture its insert result error'
  );
  assert.ok(saveCache.includes('if (error)'), 'sightengine.ts: saveImageCache must log its insert error');

  console.log('Handler credit-outcome ordering assertions passed');
  console.log('Check-path write error-logging assertions passed');
}

run();
