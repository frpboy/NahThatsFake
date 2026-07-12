1. **Optimize `/api/user/checks` endpoint in `tma/server.js`**
   - Replace sequential database queries (fetching user ID, then fetching checks) with a single resource embedding query (`supabase.from('users').select('id, checks(*)')`).
   - Use `.order()` and `.limit()` on the nested relationship using the `referencedTable` option for Supabase JS v2 to properly sort and limit the `checks`.
   - Add a comment explaining the `⚡ Bolt:` optimization and its impact (reducing DB round-trips).
2. **Verify the change locally**
   - Test the script syntax using `node --check tma/server.js`.
   - Run the API locally with mock variables and confirm it correctly returns checks (or 404 for a missing user).
3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
4. **Submit PR**
   - Use title `⚡ Bolt: Combine sequential queries into single DB round-trip for user checks`.
