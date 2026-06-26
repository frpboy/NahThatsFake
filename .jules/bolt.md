## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-15 - Redundant Crypto Verification in Express Middleware
**Learning:** HMAC calculation based on static variables (like a constant BOT_TOKEN in `.env`) placed directly inside Express authentication middleware bodies causes massive performance degradation under load because it recomputes a static hash for every single incoming API request instead of pulling from a memory cache.
**Action:** When implementing cryptographic validation middleware, always review `createHmac` operations to determine if any of the keys or data payloads are static lifecycle variables. Extract and lazily initialize static cryptographic keys outside the request-response cycle scope to reduce CPU overhead.

## 2024-05-18 - Caching User Roles in Context State to Fix N+1 Queries

**Learning:** Global middlewares and command handlers that repeatedly query the database (e.g., calling `isAdmin` or `getRole` on every message) introduce significant N+1 query bottlenecks and DB load on every action.
**Action:** Combine data fetches early in the middleware chain and cache the results in the `context.state` object (e.g., `(ctx as any).state`). Pass this cached state as an optional argument to helper functions like `isAdmin(id, cachedRole)` to preserve encapsulation while avoiding redundant database lookups.
## 2024-06-25 - Native Base64 URL Encoding Performance
**Learning:** Manual regex replacements after base64 encoding (`Buffer.from(data).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')`) are significantly slower and create more GC garbage than using Node.js's native `base64url` encoding (`Buffer.from(data).toString('base64url')`), which offers up to an 8.4x speedup.
**Action:** Always use `toString('base64url')` when generating URL-safe base64 strings in Node.js (v14.18+) to optimize performance and reduce memory allocations.
## 2024-06-25 - Resource Embedding vs Sequential Queries

**Learning:** When fetching nested resources in Supabase (e.g., finding a user and then fetching their associated checks), writing sequential queries (`.select('id').eq(...).single()`, then `checks` lookup) introduces an unnecessary network round-trip from the Node.js backend to the database.
**Action:** Use Supabase's parent-to-child resource embedding feature (e.g., `.select('id, checks(*)')`) to consolidate multiple sequential `.from()` fetches into a single network query. To apply filters, limits, and ordering to the nested checks in an embedded query, utilize the `{ foreignTable: 'checks' }` option on `.order()` and `.limit()`. Be aware that using `.single()` still correctly throws an error if the primary record (parent) is not found, preserving the original 404 handling logic of sequential queries.
