## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.
## 2024-06-14 - Global State Middleware for Role Caching
**Learning:** Multiple middlewares (e.g. rate limit, ban check, impersonation) and command handlers query the same `isOwner` or `isAdmin` status multiple times per incoming message, causing redundant trips to the Supabase database.
**Action:** Implemented a single `(ctx as any).state = {}` initial middleware early in the `bot.use` pipeline. Fetch the user's base data (`role`, `is_banned`, etc.) once, store it in `ctx.state`, and pass it to helper functions like `isAdmin(id, cachedRole)` to avoid hitting the DB multiple times per incoming request.
