1. Modify `/api/user/checks` in `tma/server.js` to use a resource embedding query instead of making two sequential queries.
   - Currently, it finds the user by `telegram_user_id` in `users`, then queries `checks` using the user's `id`. This creates two database roundtrips.
   - I will use `supabase.from('users').select('id, checks(*)').eq('telegram_user_id', userId.toString()).order('created_at', { referencedTable: 'checks', ascending: false }).limit(10, { referencedTable: 'checks' }).single()` to fetch the user and their latest checks in one query.
   - If the user isn't found, `.single()` will throw an error (which is caught and handled to return 404, or we can check the error explicitly), preserving the original 404 behavior.
2. Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
3. Submit the change with a PR.
