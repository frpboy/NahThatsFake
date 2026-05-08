## 2024-05-18 - Caching global middleware database queries
**Learning:** Found a major performance bottleneck where `getRole` was hitting the Supabase database on every single incoming Telegram update because it was used in `isAdmin` within global middleware (`bot.use`).
**Action:** Always memoize/cache DB lookups that happen in high-frequency event handlers or global middleware. Added a Map-based in-memory cache with TTL and size limits to `getRole`.
