## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.

## 2024-05-18 - [Grammy Middleware DB Optimization]
**Learning:** Sequential DB queries across multiple Grammy global middlewares execute on every single incoming message, causing a massive N+1 style bottleneck and redundant DB load.
**Action:** Combine necessary global checks (e.g., `role`, `is_banned`, `is_throttled`) into a single query in the first middleware, and cache the result in `(ctx as any).state` to allow downstream middlewares to read the state memory synchronously instead of hitting the DB again.
