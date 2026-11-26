# NahThatsFake — Phase 2 Implementation Plan (Detection Intelligence)

Detailed expansion of Phase 2 of `IMPLEMENTATION_PLAN.md` (items 2.1–2.3).
Written 26 Nov 2026 against main `b237607` (Phase 1 complete and live: bot on the
GCP VM `nahthatsfake-bot`, Mini App on Vercel, atomic credits live in production).
Every code claim below was verified against the checkout at
`~/workspace/nahthatsfake-alex-fix/` on that commit.

## Governing rules (unchanged from the master plan)

- Free app, non-profit. Premium purchases stay **disabled (410)** — nothing in
  this phase touches payment code. Free provider tiers only; no paid services.
- **Detection honesty is the brand.** Inconclusive is a first-class result and
  is never dressed as clean. A missing or malformed provider field is *no
  evidence*, never a zero score.
- **Results stay separate per check** (the PR #459 pattern): no blended
  verdicts, ever. Each sub-result carries its own score, label and status.
- GitHub writes go through the browser (owner's standing order), never the
  connector. Bot deploys = VM `git pull` + `docker compose up -d --build bot`;
  verify the deployed artifact, RestartCount 0, clean logs.

## Verified starting state (26 Nov 2026, main `b237607`)

- `bot/src/services/sightengine.ts`: `detectDeepfake()` POSTs to
  `https://api.sightengine.com/1.0/check.json` with `models: 'genai'` only,
  base64 body, 30 s timeout. Response validated by
  `validateSightengineScores()` (Phase 1.2): requires `status === 'success'`
  and numeric `scores.synthetic` / `scores.human` in [0, 1].
  `interpretSightengineResult()` bands `synthetic` at ≥ 0.8 HIGH, ≥ 0.5
  MEDIUM, else LOW, and returns `confidence = Math.max(synthetic, human)` —
  the mislabel item 2.1 must remove. Cache: `check_cache` rows keyed
  `sightengine-v2:<sha256>` with a single `api_source` string;
  `checkImageCache()` uses `.single()`, so today there is exactly one cached
  verdict per image hash.
- Sightengine deepfake model (provider docs, checked 26 Nov 2026): requested
  as `models=deepfake`, combinable in one request (`models=genai,deepfake`).
  Its result comes back in a **different field** than genai: `type.deepfake`,
  a float 0–1 (higher = more confident a face was swapped/manipulated). It
  analyses the most prominent faces; it says nothing about fully generated
  images (that is genai's job) and nothing meaningful about faceless images.
  `request.operations` is charged per model work (the docs' single-model
  deepfake example shows 5 operations), so two models per photo costs more
  free-tier quota than one — see Open Question 1.
- `bot/src/handlers/image.ts`: downloads the Telegram file via
  `ctx.api.getFile` + axios arraybuffer (largest photo size, or the document),
  sha256-hashes the buffer, checks cache, calls `detectDeepfake()`, inserts
  one `checks` row (`check_type 'image'`, `api_source 'sightengine'`), and:
  - with a caption URL: builds two `CheckOutcome`s and replies via
    `buildSeparateCheckResults()` / `formatSeparateCheckResults()`
    (`bot/src/services/separateResults.ts`, types `'image' | 'link'`), then
    settles the reservation if ≥ 1 outcome is complete, else releases it
    (reply-before-settle, PR #473);
  - without a caption: replies with its own legacy format ("Deepfake
    Detection Result", "Artificial Probability: X% Fake", share button),
    then settles. The reservation is `reserveCredit()` with idempotency key
    `tg:<update_id>:image`; duplicates stand down (PR #473).
- `bot/src/services/urlscanner.ts`: `checkUrlSafety(url)` returns
  `{ score, risk_level, sources[] }` with the Phase 1.1 completion/validation
  behaviour; throws an "inconclusive" error when no provider produced
  evidence. This is the exact function the QR flow reuses, unchanged.
- Credits (`bot/src/utils/credits.ts`): `reserveCredit` / `settleCredit` /
  `releaseCredit` with the production RPCs; owner/impersonation bypasses.
  One reservation per Telegram update per check type.
- Mini App history (`tma/public/js/app.js`, `renderChecks`): icon and label
  derive from `check_type` (`'image'` → 🖼️ "Image Analysis", anything else →
  🔗 "Link Analysis"); a row with null score/risk renders INCONCLUSIVE
  (Phase 1 pattern). Rows also carry `api_source`, currently not displayed.
  **Consequence:** new result kinds can be stored today with zero schema
  change if they reuse `check_type` values and distinguish themselves in
  `api_source`; the TMA needs only a label tweak to show that distinction.
- No image-decoding or QR dependency exists anywhere (`bot/package.json`
  deps are only @supabase/supabase-js, axios, dotenv, grammy, node-cron).
  Telegram `photo` sizes are always JPEG; user-sent *documents* can be PNG
  or WebP. The bot image runs `node:22-alpine` (Docker), so native binaries
  are a deployment risk to avoid.

---

## 2.1 Sightengine `deepfake` model as a separate second image result

### Goal and user-visible behaviour

A photo check returns **two independent image results**:

1. **AI-generated** (genai model, as today), and
2. **Face manipulation** (deepfake model — face swapped or altered),

each with its own score, risk band, or INCONCLUSIVE, in the bot reply and in
Mini App history. Neither is ever merged into the other, and neither borrows
the other's verdict. The misleading parts of today's single-result copy are
fixed in the same item: the result is no longer titled "Deepfake Detection"
when it is the genai score, scores are described as provider scores (signal
strength), and the fabricated `confidence = Math.max(...)` figure disappears
from every surface.

### Design

**One combined request, per-model validation.** Change `detectDeepfake()`
into `analyzeImage(imageBuffer)` in `sightengine.ts`:

- Single POST to `check.json` with `models: 'genai,deepfake'` (docs confirm
  models combine in one request; one 30 s timeout as today). One request
  keeps latency and failure modes simple; the response carries both models'
  blocks, and each block is validated **independently**:
  - genai: existing `validateSightengineScores()` (status + `scores.*`).
  - deepfake: new `validateDeepfakeScore(data)`: requires `status ===
    'success'` and `type.deepfake` a finite number in [0, 1]. A missing
    `type` block, a missing field, or a non-numeric value ⇒ that sub-result
    is inconclusive (provider gave no usable evidence) — **never** read as
    0 / LOW. This matters most for faceless images, where the model has
    nothing to analyse.
  - If the whole request fails/times out, both sub-results are inconclusive
    (same classification path as today via `classifyServiceError`).
- Return shape: `{ genai: ModelOutcome, deepfake: ModelOutcome, raw_response }`
  where `ModelOutcome = { status: 'complete', score, risk_level } |
  { status: 'inconclusive', reason }`. Keep `detectDeepfake()` as a thin
  deprecated wrapper only if a caller still needs it; prefer updating the
  single caller (the image handler) and deleting the old name, since the
  function never actually detected deepfakes.
- **Thresholds (provisional, stated as such):** band `type.deepfake` exactly
  like genai today (≥ 0.8 HIGH, ≥ 0.5 MEDIUM, else LOW) for consistency of
  the user-facing scale. These are *starting* bands, not calibrated values;
  item 2.3's evaluation run is where they get reviewed, and the plan forbids
  publishing any accuracy claim until then. Display copy for LOW is "no
  strong signs found", never "genuine" / "real photo".
- **Score semantics copy** (shared with 2.3): each sub-result is labelled
  with what the number is — e.g. "AI-generated check — provider score 12%
  (higher = stronger signs of AI generation)". The word "Probability" and
  "% Fake" phrasing are removed from the bot reply and the share text.

**Result model.** Extend `bot/src/services/separateResults.ts`:

- `SeparateCheckResult.type` becomes
  `'image-genai' | 'image-deepfake' | 'link' | 'qr'` (the `'qr'` member is
  added here so 2.2 does not have to re-touch the type union; 2.2 wires its
  formatter section). Keep a mapping so existing `'image'` inputs from the
  caption-link path are expressed as `image-genai` + `image-deepfake`.
- `formatOneResult` gains a "🎭 *Face manipulation check*" section mirroring
  the image section's inconclusive wording ("the face-manipulation service
  returned no usable result" / timeout variant).
- The no-caption bot path is moved onto `buildSeparateCheckResults()` /
  `formatSeparateCheckResults()` too (today it hand-rolls its own reply), so
  a plain photo shows the same two-section layout. The share button/share
  text move to the end of that reply and quote **both** sub-results (or
  "inconclusive" per section); no single-number share text.

**History storage — no schema change.** Insert **two** `checks` rows per
analysed photo, both `check_type: 'image'`, distinguished by `api_source`:
`'sightengine-genai'` and `'sightengine-deepfake'` (cached rows keep the
same labels; `cached` flag as today). An inconclusive sub-result inserts a
row with `score: null, risk_level: null`, which the TMA already renders as
INCONCLUSIVE. In `tma/public/js/app.js` `renderChecks`, extend the label:
image rows show "Image Analysis · AI-generated" or "Image Analysis · Face
manipulation" based on `api_source` (fall back to plain "Image Analysis"
for legacy `'sightengine'` rows).

**Cache — per model, version bump.** `checkImageCache` / `saveImageCache`
become per-model: content hash key `sightengine-v3:<sha256>:genai` and
`sightengine-v3:<sha256>:deepfake` (the current `.single()` lookup cannot
return two rows for one hash; keying per model keeps `.single()` valid).
Bump to v3 so pre-2.1 single-verdict rows are unreachable, following the
PR #465 namespacing precedent. A cache hit for one model and a miss for the
other is a normal case: call the API only if at least one model is
uncached, and when calling, request both models but only persist the
missing model's row if the other was already cached (simpler alternative
accepted: persist both fresh rows; the cached model's row is refreshed —
choose the simpler one in implementation and note it in the PR).

### Credits and idempotency

Unchanged shape: one reservation per photo message, key
`tg:<update_id>:image`, `check_type 'image'`. Settle if **at least one** of
{genai, deepfake, caption-link} outcomes is complete; release only if
**all** are inconclusive — the existing rule, extended from two outcomes to
three. Reply-before-settle ordering (PR #473) is preserved: the combined
reply is sent first, settle/release after. Duplicate-delivery stand-down is
untouched.

### Files touched

- `bot/src/services/sightengine.ts` — `analyzeImage()`,
  `validateDeepfakeScore()`, per-model cache functions, remove the
  `Math.max` confidence from the returned shape.
- `bot/src/services/separateResults.ts` — type union, labels, face section,
  headline logic for 3-way partial results.
- `bot/src/handlers/image.ts` — consume two sub-outcomes, two history rows,
  unified separate-results reply on both paths, share text update,
  settle/release rule extension.
- `tma/public/js/app.js` — history label by `api_source` (+ cache-bust
  query version bump, as done in PR #469).
- Tests: extend `bot/tests/sightengine.test.ts`,
  `bot/tests/separate-results.test.ts`, `bot/tests/handler-outcomes.test.ts`.

### Tests

- Unit: `validateDeepfakeScore` — valid score; missing `type`; missing
  field; string score; out-of-range; non-success status ⇒ all throw.
- Unit: combined-response interpretation — both blocks valid ⇒ two
  complete outcomes; deepfake block missing + genai valid ⇒ genai complete,
  deepfake inconclusive (never LOW); genai malformed + deepfake valid ⇒
  mirror image.
- Separate-results: genai complete + deepfake timeout ⇒ two sections,
  face section INCONCLUSIVE, partial headline names the face check;
  both complete ⇒ distinct labels, no merged verdict anywhere in the text.
- Handler-outcomes (source-level, repo precedent): reply is sent before
  settle; settle occurs when exactly one of three outcomes is complete;
  release when all three are inconclusive; two history inserts with the
  two `api_source` labels.
- Cache: per-model keys — a genai-only cached fixture does not satisfy the
  deepfake lookup.
- Live-only verification (cannot be stubbed): one real photo with a face
  and one faceless photo sent to the production bot after deploy; confirm
  two sections render, the faceless photo's face result behaves as
  designed (score or inconclusive, never a crash), and two history rows
  appear in the Mini App with the right labels. Also confirm the
  Sightengine dashboard operation count for one check (feeds Open
  Question 1).

### Risks

- Free-tier operations quota roughly doubling per photo (mitigated by the
  per-model cache; measured in the live check above).
- Sightengine returning `type.deepfake` in a different shape under the
  combined request than under a solo request — the live verification step
  exists precisely to catch this before calling the item done; the
  per-model validator makes the failure mode "inconclusive", not "wrong
  verdict".

---

## 2.2 QR code scam detection

### Goal and user-visible behaviour

A user sends a photo (or image document) that contains a QR code. The bot
decodes it locally and reports the destination **separately** from the image
results:

- **URL payload** ⇒ the URL is shown in full and run through the existing
  `checkUrlSafety()`; the QR section shows the link verdict, labelled as
  the QR code's destination.
- **Payment URI** (`upi://pay?...`, and other `://` payment schemes) ⇒ the
  destination and payee parameters are shown prominently with a caution.
  The bot **never** says a payment QR is "safe to pay" — a QR pointing at
  the *correct-looking* payee can still be a sticker-swap scam, and the
  copy says exactly that.
- **Any other text** ⇒ shown verbatim, labelled as untrusted content read
  from the QR code, with no verdict.
- **No QR found / undecodable** ⇒ no QR section at all (normal photos are
  unaffected), except when decode fails on a supported format for a
  technical reason, where the behaviour is still silence — a photo is not
  an error just because it has no QR. (A dedicated "couldn't read a QR"
  reply exists only if the owner later adds a QR-only mode; not in scope.)

### Design

**Library choice (free, Node, Alpine-safe).** `jsqr` (MIT, pure JS) for
decoding, fed RGBA pixels by `jpeg-js` (BSD, pure JS) for JPEG and `pngjs`
(MIT, pure JS) for PNG. No native binaries (rules out `sharp` — prebuilt
musl wheels are a Docker/Alpine risk the bot does not need) and no external
service (rules out API-based decoders — paid/privacy). Telegram `photo`
payloads are always JPEG, so `jpeg-js` covers the main path; PNG covers
screenshots sent as documents. WebP documents are **not** decodable with
this stack: the QR attempt skips them silently (image checks proceed
normally) — stated in the PR so the limit is deliberate, not discovered.

**New service `bot/src/services/qr.ts`:**

- `decodeQrFromImage(imageBuffer: Buffer, mimeHint?): QrDecodeResult`
  where the result is `{ status: 'decoded', payload: string } |
  { status: 'none' } | { status: 'unsupported-format' }`.
  Sniff format from magic bytes (JPEG `FF D8`, PNG `89 50 4E 47`), not
  from the Telegram metadata. Decode to RGBA, run `jsQR` once; on failure,
  one retry against an inverted/downscaled copy is **not** in scope for
  v1 (keep v1 simple and predictable; note as a possible 2.2b).
  Size guard: skip decode (status `'none'`) if the decoded pixel count
  exceeds ~16 MP, to bound CPU on the 1 GB VM.
- `classifyQrPayload(payload)`: `'url'` (http/https), `'payment'`
  (`upi://` or scheme match list), or `'text'`. URL normalisation reuses
  the URL scanner's expectations — pass the payload string to
  `checkUrlSafety()` unchanged.
- The QR attempt runs on the **same downloaded buffer** the image handler
  already fetched (no second download), after the image analysis, inside
  the same handler invocation. For decode cost on large photos, prefer
  decoding from a smaller `photo` size variant when Telegram offers one
  in the 800–1280 px range (the handler currently takes the largest size
  for Sightengine; the QR attempt may fetch that mid-size variant
  separately — one extra `getFile` download, no extra Sightengine cost).

**Result composition.** `separateResults.ts` gains the `'qr'` section
(type added in 2.1): "📷 *QR code check*" with three renderings — link
verdict (destination URL printed in full above the verdict, so a punycode/
lookalike domain is visible), payment caution (payee address + name
parameters printed, caution copy, no risk band), or raw text (verbatim in
a code block, "this is what the QR code contains; it has not been
verified"). A QR URL verdict is a **link** verdict about the destination;
it never upgrades or downgrades the image sub-results.

**History storage.** A decoded URL scan inserts a `checks` row with
`check_type: 'link'` and `api_source: 'qr: ' + sources.join(', ')` (e.g.
`qr: Google Safe Browsing, VirusTotal`), content hash = the existing URL
hash (`urlscanner-v3:` prefix as in the current scanner cache keying).
Payment/text payloads insert **no** history row in v1 (there is no verdict
to record, and storing raw payment payloads is a privacy cost without a
display design); the bot reply is the record. TMA needs no change: the row
renders as a link check, and the `qr:` prefix is visible if `api_source`
is ever surfaced.

### Credits and idempotency

The QR attempt rides the photo message's existing reservation
(`tg:<update_id>:image`) — **one message, one credit**, whether it yields
image results, a QR result, or both (consistent with the caption-link
rule). Settle if at least one outcome across {genai, deepfake, caption
link, QR-URL} is complete; release only if all are inconclusive **and**
no QR payload was decoded (a decoded payment/text payload counts as a
delivered result for settle purposes — the user got the thing they sent
the photo for; see Open Question 2). A QR-only document (e.g. a screenshot
whose image analysis is inconclusive but whose QR decodes) therefore
still settles. Duplicate-delivery stand-down and reply-before-settle are
inherited unchanged.

### Files touched

- `bot/package.json` — add `jsqr`, `jpeg-js`, `pngjs` (runtime deps);
  root `package.json` unchanged (test chain gains `test:qr` via
  `bot/package.json` + root scripts, same pattern as `test:handlers`).
- `bot/src/services/qr.ts` — new: decode + classify.
- `bot/src/handlers/image.ts` — QR attempt, QR outcome into the
  separate-results build, settle/release rule extension, history insert
  for QR-URL scans.
- `bot/src/services/separateResults.ts` — `'qr'` formatter section
  (payment and text renderings included).
- `bot/tests/qr.test.ts` — new; `bot/tests/fixtures/qr/` — committed
  fixture images (generated once with a small script kept in the test
  folder, using the `qrcode` package as a **dev-only** generator, not a
  runtime dep): QR→https URL, QR→UPI URI, QR→plain text, a photo with no
  QR, a corrupted/blurry QR image.
- `bot/tests/handler-outcomes.test.ts` — extend for QR settle rules.

### Tests

- Unit: payload classification (URL / UPI / other scheme / plain text /
  empty); magic-byte format sniffing; unsupported format (WebP header)
  ⇒ `'unsupported-format'`, no throw.
- Fixture decode: the https fixture decodes to the exact URL; the UPI
  fixture decodes and classifies `'payment'`; the no-QR photo ⇒ `'none'`;
  the corrupted fixture ⇒ `'none'` (not an exception).
- Separate-results rendering: QR-URL section prints the full destination
  and the link verdict; payment section contains the caution copy and
  **no** risk band / no "safe" wording (assert on the string); text
  section is verbatim.
- Handler-outcomes: QR-URL complete + both image models inconclusive ⇒
  settle; everything inconclusive + no payload ⇒ release; payment payload
  decoded + image inconclusive ⇒ settle.
- URL scanner is reused, not re-tested (its suite already covers
  verdict/inconclusive behaviour).
- Live-only: send the bot a real UPI payment QR photo and a real
  scam-style URL QR photo; confirm the destination rendering, the caution
  copy, the history row (`api_source` starting `qr:`), and that a normal
  no-QR photo reply is byte-identical in structure to before.

### Risks

- `jpeg-js` on very large JPEGs is slow (pure JS); the 16 MP guard and
  the mid-size variant preference bound this. Measure in the live check
  on the e2-micro VM; if a single decode exceeds ~5 s, drop the size cap.
- jsQR's real-world detection rate on photographed (not screenshotted) QR
  codes is lower than on clean images; the honest failure mode is "no QR
  section", never a wrong payload — acceptable for v1, noted in the PR.

---

## 2.3 Evaluation set and honest score semantics

### Goal and user-visible behaviour

Two halves. (a) **Semantics:** every number the app shows has a written
definition in the result copy — what the provider score means, what LOW
does and does not claim, and what inconclusive means — applied uniformly
in the bot and the Mini App. (b) **Measurement:** a small, maintained,
rights-clean evaluation set with a runner that reports per-category
outcomes for both image models and the URL scanner, so any future quality
claim (or threshold change) rests on recorded runs, not vibes. No numeric
accuracy figure is published from a single run, and none is shown to
users.

### Design — semantics

- A single copy block owned by `bot/src/services/separateResults.ts`
  (bot) and mirrored in the Mini App history/detail strings (`tma/public/
  js/app.js`): score = "provider score, 0–100% signal strength, not a
  probability that the content is fake"; LOW = "no strong signs found —
  this cannot prove an image is genuine"; INCONCLUSIVE = "the check could
  not be completed; there is no verdict". 2.1 already removes
  "Probability"/"% Fake" from the image paths; 2.3 sweeps the remaining
  surfaces (link result wording in `formatOneResult`, share texts,
  Mini App labels) for the same vocabulary.
- Threshold changes are **output** of this item, not input: if the first
  full run shows a band misbehaving (e.g. face-swapped fixtures landing
  mostly MEDIUM), the follow-up PR proposes new bands with the run report
  attached. Bands stay symmetric across genai/deepfake unless the data
  says otherwise.

### Design — evaluation set

- **Location:** `evaluation/` at repo root, **outside** the shipped bot
  bundle (the bot's Docker build copies `bot/`; fixtures never reach the
  VM image). `evaluation/fixtures/` (media), `evaluation/manifest.json`
  (one entry per sample: file, category, expected outcome class, source,
  licence, sha256), `evaluation/run.ts` (runner), `evaluation/README.md`
  (how to run, what the numbers mean, current threshold table).
- **Size (starter):** 60 images — 10 each of: genuine photographs,
  AI-generated, AI-edited (real photo + generative edit), face-swapped,
  social-media-compressed (genuine photos put through WhatsApp-style
  recompression), screenshots/low-resolution mixed content. Plus 20 URLs
  (10 known-benign, 10 known-malicious/scam from public blocklist samples
  that are safe to store as text, e.g. PhishTank/OpenPhish-listed domains
  recorded as URLs, never visited by the runner in stub mode).
- **Sources — legal and free only:**
  - Genuine + compressed + screenshots: the owner's own photos (owner
    supplies; consent is his own), plus Wikimedia Commons photographs
    under CC licences recorded per-file in the manifest.
  - AI-generated / AI-edited: generated with free tooling by the owner/
    agent, plus Commons' AI-generated media (licence recorded per file).
  - Face-swapped: **self-made only** — swaps produced locally with free
    open-source tooling on the owner's own photos and Commons portraits.
    No scraped celebrity/deepfake datasets, no redistributed
    FaceForensics++ media (its terms forbid committing the media to a
    public repo; it may be used later as a *local-only* overlay via a
    manifest of hashes, not files — out of scope for the starter set).
  - Every manifest entry carries its licence/source; a fixture without a
    recorded licence does not get committed.
- **Runner:** `npm run evaluate` (root script, not part of `npm test`).
  Two modes: `--stub` (providers replaced by recorded/stubbed responses —
  deterministic, runs anywhere, verifies the *pipeline* and report code)
  and live (calls the real `analyzeImage()` / `checkUrlSafety()` with the
  bot's env; spends free-tier quota; run manually, never in CI). The
  runner bypasses credits and the checks table entirely (it calls the
  services directly) and writes `evaluation/results/<date>.md` +
  `.json`: per-category counts of correct / false-positive /
  false-negative / inconclusive for each of genai, deepfake, and the URL
  scanner, the score distribution per category, and the threshold table
  in force. **Inconclusive is reported as its own column, never folded
  into correct or incorrect.**
- **Where it runs:** stub mode anywhere (and it is wired as a manual
  script, not a gate); live mode from the owner's/agent's machine or the
  VM shell against production credentials. Results files are committed
  (they are small text) so quality history is versioned with the code.

### Files touched

- `evaluation/` — new directory as above (fixtures + manifest + runner +
  README); root `package.json` — `evaluate` script only.
- `bot/src/services/separateResults.ts`, `bot/src/handlers/image.ts`,
  `bot/src/handlers/link.ts` (only if its result wording needs the same
  vocabulary sweep), `tma/public/js/app.js` — copy alignment.
- No service logic changes in this item except copy; any threshold change
  the data motivates is a separate follow-up PR citing the run.

### Tests

- Runner stub mode executes end-to-end in the sandbox and produces a
  report whose per-category totals equal the manifest counts (asserted
  by a small self-check in the runner: totals mismatch ⇒ non-zero exit).
- Manifest validation: every fixture file exists, hash matches, licence
  field non-empty (script check, run in stub mode).
- Copy sweep: source-level test (repo precedent) asserting the strings
  "Probability" and "% Fake" no longer appear in bot result formatting,
  and that the LOW/inconclusive definitions are present in the formatter
  output.
- Live-only: the first live run itself (60 images + 20 URLs) and its
  committed report; the threshold review note written from it.

### Risks

- Fixture bias: 60 hand-picked images cannot support broad accuracy
  claims — the README and this plan both forbid publishing percentages
  from it; it exists to catch regressions and gross band errors.
- Live runs spend Sightengine/VirusTotal quota; 60 images ≈ 60 combined
  requests. Schedule live runs sparingly (per detection change, not per
  commit).

---

## Rollout order and dependencies

1. **2.1 first.** It extends the result model (`separateResults.ts` type
   union, including reserving `'qr'`), the cache keying, and the handler's
   settle rule — all the shared plumbing 2.2 then builds on. Its copy
   fixes (no "confidence", no "% Fake") land here, not in 2.3.
2. **2.2 second.** Depends on 2.1's type union and three-outcome settle
   logic; adds the decode stack and the QR formatter sections.
3. **2.3 last.** Its semantics sweep assumes 2.1/2.2 surfaces exist in
   final form; its first live run then measures the finished Phase 2
   detection stack (both models + QR-fed URL scans) and produces the
   threshold review.

Each item ships as its own PR (browser route) with the full root test
chain green, its own issue created at implementation start, and a bot
redeploy + live verification per item (2.3's live step is the evaluation
run). No item waits on an owner decision except where an Open Question
below is marked blocking.

## Definition of Done — Phase 2

- Both image models live as separate results in bot + Mini App history,
  per-model validation and caching in place, fabricated "confidence"
  gone from every surface.
- QR decoding live for JPEG/PNG with URL / payment / text handling as
  specified; payment copy contains no safety claim; QR-URL scans visible
  in history with the `qr:` source prefix.
- Evaluation set committed with licences recorded, stub run green, first
  live run report committed, threshold review note written (even if the
  note says "bands unchanged").
- Full root `npm test` chain green on final main; bot redeployed and
  verified (RestartCount 0, clean logs); the three live verifications
  (faced photo, faceless photo, real UPI QR) done against production.
- Deferred Phase 1 remainders (below) still tracked as their own items —
  not absorbed, not forgotten.

## Explicitly NOT in Phase 2 (Phase 3 — do not silently absorb)

- Transactional outbox for abuse-flag → enforcement retry and atomic
  audit writes (deferred in PR #472's review follow-up).
- Stale-reservation sweeper for crash-orphaned credit reservations, and
  durable settle/release reconciliation (deferred in PR #473's follow-up).
- Live-Postgres race tests in CI (needs a CI Postgres service; also the
  Phase 3 CI item generally, incl. landing PR #409).
- Scanner-level in-flight scan coalescing (open issue #467) — 2.2's
  handler-level duplicate guard already exists from Phase 1; #467 stays
  its own item.
- Atomic-increment RPC for the owner-only admin credit grant path.

## Open questions for the owner (genuine decisions only)

1. **Deepfake quota policy (blocking for 2.1 scope):** two models per
   photo costs materially more Sightengine free-tier operations. Run
   deepfake on *every* photo (simplest, most honest coverage), or only
   when a face is likely present / genai is ambiguous (cheaper, but some
   photos silently get one result instead of two)?
2. **QR settle rule:** this plan counts a decoded payment/text payload
   as a delivered result (settles the credit) even if image analysis was
   inconclusive. Agree, or should only verdict-bearing outcomes (image
   or URL) ever settle?
3. **Payment QR caution copy:** the plan shows payee address + name from
   the UPI URI with an explicit sticker-swap caution and no safety
   verdict. Is showing the payee *name* parameter acceptable (it is
   attacker-controlled text), or should only the payee address (VPA) be
   displayed?
4. **Evaluation live runs:** may the runner send the 60 fixture images
   (owner/Commons material) to the live Sightengine API, spending quota
   — or should live runs be owner-triggered only, with stub mode the
   default everywhere else?
5. **History granularity:** two history rows per photo (one per model,
   this plan's zero-schema-change choice) vs one row per photo with both
   results inside it (needs a `checks` schema/display change). The plan
   defaults to two rows; confirm that's the history UX you want.

## Owner decisions (26 Nov 2026)

- **Q1 DECIDED:** Deepfake runs only when a face is present/likely —
  not on every photo. (Owner: "Deepfake only for face.")
- **Q4 DECIDED:** Owner delegated ("do what's better") — evaluation
  live runs are owner-triggered only; stub mode is the default
  everywhere else. Fixtures do not leave the machine and free-tier
  quota is not spent without the owner explicitly running it.
- **Q5 DECIDED:** Owner delegated ("do what's better") — two history
  rows per photo (one per model), the zero-schema-change option,
  consistent with the separate-results pattern from PR #459.
- **Q2 DECIDED:** No verdict, no cost. A decoded QR payload that
  carries no verdict (text/payment payload shown as-is) does NOT
  settle the credit — the reservation is released. Only
  verdict-bearing outcomes (image analysis or a URL scan of a QR's
  link) settle. (Owner: "No cost when there's no verdict",
  26 Nov 2026 — this overrides the plan's original settle-on-decode
  proposal in §2.2, which must be built to this rule.)
- **Q3 DECIDED:** Owner delegated ("do the better", 26 Nov 2026) —
  the payee ADDRESS (VPA) is the primary display; the payee name from
  the payload may be shown only underneath it, explicitly labelled as
  text written inside the QR that can be faked, never as a verified
  identity. All five Phase 2 questions are now closed.
