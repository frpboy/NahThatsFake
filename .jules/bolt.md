## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-18 - Caching global middleware database queries
**Learning:** Found a major performance bottleneck where `getRole` was hitting the Supabase database on every single incoming Telegram update because it was used in `isAdmin` within global middleware (`bot.use`).
**Action:** Always memoize/cache DB lookups that happen in high-frequency event handlers or global middleware. Added a Map-based in-memory cache with TTL and size limits to `getRole`.
