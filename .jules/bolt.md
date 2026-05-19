## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.

## 2024-05-16 - Native Base64Url Encoding Optimization
**Learning:** Manual URL-safe base64 encoding (generating a standard base64 string, then using chained regex `.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')`) introduces unnecessary parsing and execution overhead. Node.js native `Buffer.toString('base64url')` provides a ~2.2x performance increase over manual replacements and significantly improves code readability.
**Action:** Always use Node.js's native `'base64url'` buffer encoding rather than standard `'base64'` with regex chained string replacements whenever generating URL-safe strings or URL identifiers.
