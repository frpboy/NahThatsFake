## 2024-09-04 - Eliminate redundant database queries during impersonation checks
**Learning:** `checkCredits` makes a redundant database query if the `cachedUser` parameter is not provided.
**Action:** When the user object has already been fetched earlier in the handler (like `dbUser`), always pass it as the `cachedUser` argument to utility functions like `checkCredits` and `consumeCredit` to prevent N+1 query performance bottlenecks.
## 2024-09-04 - Optimize database counting queries
**Learning:** Fetching all columns (`*`) when only the count is needed wastes memory and bandwidth.
**Action:** When using `{ count: 'exact', head: true }` in Supabase, explicitly select only the primary key column (e.g., `id`) instead of `*` to minimize payload size and improve database counting performance.
## 2024-09-04 - Combine independent database queries in fulfillment paths
**Learning:** Checking idempotency and fetching a user record sequentially causes unnecessary latency.
**Action:** When handling a webhook or payment verification, combine independent queries (like fetching user details and checking if a payment already exists) using `Promise.all` to halve network latency.
