## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-11-20 - Grouping Independent DB Counting Queries

**Learning:** When executing multiple independent counting queries (e.g., getting `users` count and `checks` count in a bot command), executing them sequentially increases the total network latency. This latency accumulates for each `await`.

**Action:** Group independent counting queries (like multiple `{ count: 'exact', head: true }` calls) concurrently using `Promise.all` to reduce overall network latency and improve response times. Ensure potential `null` counts are handled when displaying the values.
