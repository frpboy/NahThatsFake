## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.
## 2024-05-28 - Consolidate GramJS global middleware DB queries
**Learning:** Global middlewares in GramJS run on every single incoming message. Having separate global middlewares (e.g., rate limit, ban check, impersonation check) that each execute DB queries independently (like checking roles or ban status) results in a devastating N+1 query problem on the database backend for every message.
**Action:** When working with global middleware, fetch all required user metadata (roles, ban status, etc.) in a SINGLE query in the first middleware, and cache the computed flags in `(ctx as any).state` to be reused by downstream middlewares, eliminating redundant database calls.
