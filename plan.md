1. **Identify Performance Issue**: The `bot.on('message:photo')` and `bot.on('message:document')` handlers make a redundant database query to fetch the `consent_given` field for users sending images.
   - Before: The middleware at the start of each request already queries the `users` table via `supabase.from('users').select('role, is_banned, banned_reason, banned_until, is_throttled, throttled_until')` and stores the resulting data in `(ctx as any).state.userRecord`.
   - Then, when handling `message:photo` and `message:document`, the code runs `supabase.from('users').select('consent_given')` to check if consent has been given.
   - We can just add `consent_given` to the initial middleware select query and avoid an entire database round trip when handling images.

2. **Modify `src/index.ts` to include `consent_given` in initial select query**:
   - Change `select('role, is_banned, banned_reason, banned_until, is_throttled, throttled_until')` to `select('role, is_banned, banned_reason, banned_until, is_throttled, throttled_until, consent_given')`.

3. **Modify `bot.on('message:photo')` and `bot.on('message:document')`**:
   - Remove the `supabase.from('users').select('consent_given')` redundant query.
   - Use `const userRecord = (ctx as any).state.userRecord;` and `userRecord?.consent_given` instead.

4. **Verify changes & Type Check**:
   - Run `pnpm run typecheck` inside `bot/`.

5. **Create Journal Entry**:
   - Add a journal entry to `.jules/bolt.md` reflecting this performance improvement.

6. **Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.**

7. **Submit the PR**:
   - PR Title: `⚡ Bolt: Combine user field queries to eliminate redundant DB calls on image upload`
   - PR Description matching the Bolt prompt requirements.
