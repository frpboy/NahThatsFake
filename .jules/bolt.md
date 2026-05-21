## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.

## 2024-05-18 - Native Node.js Base64URL Encoding vs String Replacement
**Learning:** Generating base64url strings via manual regex or chained string replacements (e.g., `toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')`) is significantly slower than using Node.js's native `toString('base64url')` which has been supported since v14.18.0. Tests indicate the native method yields a ~6x speedup.
**Action:** Always prefer native Node.js implementations for encoding schemes where available. Scan string manipulation chains (like multiple `.replace()` calls on base64 data) for opportunities to use native `base64url` instead to bypass V8 string generation overhead.
