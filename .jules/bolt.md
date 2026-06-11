## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.
## 2024-06-11 - Combine DB Fetching in Global Middleware

**Learning:** When using Grammy global middleware that executes on every incoming message, multiple consecutive database queries (e.g. checking user roles, checking ban status, checking throttled status) can create a severe performance bottleneck. Specifically, checking `isAdmin(user.id.toString())` which performs a `.select('role')` and then later `.select('is_banned, banned_reason, banned_until, is_throttled, throttled_until')` results in N+1 redundant queries to the database for every single message.
**Action:** Combine data fetches into a single Supabase query and cache the results (e.g. user roles) in `(ctx as any).state`. Always explicitly initialize the state first via `(ctx as any).state = (ctx as any).state || {};` to prevent TypeErrors, and pass the cached state into helper functions like `isAdmin(id, cachedRole)` to preserve encapsulation instead of directly hardcoding DB column assumptions.
