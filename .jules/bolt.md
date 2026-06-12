## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.

## 2024-06-03 - Native Base64Url Encoding Optimization
**Learning:** Manual base64 encoding followed by chained regex replacements (`.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')`) to create URL-safe base64 strings is significantly slower than using Node.js's native `toString('base64url')` which operates directly in C++. A performance test revealed an ~8.4x speedup using the native implementation, and it also heavily reduces intermediate garbage string creation that triggers GC.
**Action:** When converting buffers to URL-safe base64 representations in Node.js (v14.18+), always utilize `Buffer.from(data).toString('base64url')` directly instead of manually stripping equals signs and substituting plus/slash characters.
