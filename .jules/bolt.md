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
## 2024-07-28 - Optimize sequential Supabase queries into single round-trip

**Learning:** When fetching sequential resources from Supabase (like fetching a user by `.single()` and then immediately fetching their associated checks), doing so via two `.await`ed database requests adds a full redundant round-trip of latency. Instead of sequential requests or `.inner` joins that break the `.single()` error handling, using parent-to-child resource embedding (`.select('id, checks(*)')`) combines both into one query. Modifiers like `.limit()` and `.order()` can still be correctly applied to the nested resource using the `foreignTable` option.

**Action:** Always prefer combining sequential queries into single resource embedding queries. When `.single()` is used for its side-effect of throwing an error when the parent record doesn't exist (e.g. 404 user not found), preserve the parent-to-child query direction. Apply modifiers to nested tables using `{ foreignTable: 'tablename' }`.
