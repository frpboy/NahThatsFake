## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.
## 2024-05-13 - [Optimize abuse flag counting]
**Learning:** Found a common anti-pattern where an entire dataset is fetched into memory to calculate lengths of filtered arrays. This leads to inefficient memory utilization and potential bottlenecks, especially for large datasets.
**Action:** Always prefer using database-native counting functionality like Supabase's `{ count: 'exact', head: true }` and perform related queries concurrently using `Promise.all` to minimize latency and memory usage. Time-based filters should also be pushed down to the database level using operators like `.gt()`.
