## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2026-05-07 - In-Memory Role Caching for Middleware

**Learning:** Telegram bot applications processing messages heavily leverage middleware functions for validation (e.g., rate limits, ban checks). Performing a database query for roles (like `isAdmin` or `isOwner`) on every message creates severe and unnecessary latency and load bottlenecks for the DB.

**Action:** Apply lightweight, short-lived (e.g., 5 min) in-memory TTL caches using `Map` directly in the data access functions for static or rarely-changing attributes to drastically reduce DB load, ensuring memory management by including simple randomized garbage collection if external libraries are not permitted.
