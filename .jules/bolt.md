## 2024-05-09 - DB-Level Counting vs Memory Array Counting

**Learning:** When generating stats like user or check counts, using `.select('id')` to fetch all rows and doing `users.length` in Node.js creates a major memory bottleneck. As the DB grows, pulling thousands/millions of rows into application memory to count them causes excessive network transfer and potential Out-Of-Memory (OOM) crashes.

**Action:** Always use the database's native counting mechanisms. For Supabase, use `{ count: 'exact', head: true }` so the database only returns a single integer over the network. Combine multiple independent stat queries using `Promise.all` to reduce latency.

## 2024-05-14 - Time-based count queries without fetching arrays

**Learning:** When evaluating thresholds (e.g., daily/weekly counts for abuse enforcement), retrieving the full row sets filtered in JS is unnecessary and causes large payload sizes plus array iteration overhead.

**Action:** Push the time filtering down to the database level using `gt()` (greater than) alongside `{ count: 'exact', head: true }` and execute multiple parallel queries using `Promise.all` to fetch multiple time-based counts instantly.

## 2024-05-14 - Early return before expensive parallel DB operations

**Learning:** When using `Promise.all` to fetch multiple DB values concurrently (like multiple time-based counts for abusers), it's important to remember the "happy path". If the vast majority of users have 0 flags, firing 3 parallel queries unconditionally triples the DB load unnecessarily.

**Action:** Always fetch the most restrictive/cheapest condition first (e.g., `totalCount`). If it's zero, return early. Only fire the expensive parallel queries if the base condition is met.
