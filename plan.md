1. **Analyze Performance Bottleneck**:
The instructions state:
> Performance & Architecture Convention: To prevent redundant database queries in Grammy global middleware (which execute on every message), combine data fetches into a single Supabase query and cache the results (e.g., user roles) in `(ctx as any).state`. Always explicitly initialize the state first via `(ctx as any).state = (ctx as any).state || {};` to prevent TypeErrors, pass the cached state into helper functions like `isAdmin(id, cachedRole)` to preserve encapsulation, and explicitly set fallback values (e.g., `userRole = 'user'`) when the database returns no data to prevent redundant queries for brand-new users.

Currently, `isAdmin(user.id.toString())` makes a query, and then `.select('is_banned, banned_reason, banned_until, is_throttled, throttled_until')` makes another query. Also `isAdmin` and `isOwner` are called repeatedly on every command or handler, causing N+1 queries.

2. **Modify `bot/src/utils/roles.ts`**:
   - Change the functions to accept an optional `cachedRole`:
     ```ts
     export async function getRole(telegramId: string, cachedRole?: string): Promise<'owner' | 'admin' | 'user'> {
       if (cachedRole) return cachedRole as 'owner' | 'admin' | 'user';
       const { data } = await supabase
         .from('users')
         .select('role')
         .eq('telegram_user_id', telegramId)
         .maybeSingle();

       return (data?.role as 'owner' | 'admin' | 'user') || 'user';
     }

     export async function isOwner(telegramId: string, cachedRole?: string): Promise<boolean> {
       const role = await getRole(telegramId, cachedRole);
       return role === 'owner';
     }

     export async function isAdmin(telegramId: string, cachedRole?: string): Promise<boolean> {
       const role = await getRole(telegramId, cachedRole);
       return role === 'owner' || role === 'admin';
     }
     ```

3. **Refactor `bot/src/index.ts` Global Middlewares**:
   - Above the global ban check, insert a state initialization middleware that also combines data fetches.
   ```ts
   bot.use(async (ctx, next) => {
     (ctx as any).state = (ctx as any).state || {};
     const user = ctx.from;
     if (!user) return next();

     const { data } = await supabase
       .from('users')
       .select('role, is_banned, banned_reason, banned_until, is_throttled, throttled_until')
       .eq('telegram_user_id', user.id.toString())
       .maybeSingle();

     (ctx as any).state.role = data?.role || 'user';
     (ctx as any).state.userRecord = data || null;

     await next();
   });
   ```
   - Update the Ban Check middleware to use the cached `userRecord` and `role`.
   ```ts
   bot.use(async (ctx, next) => {
     const user = ctx.from;
     if (!user) return next();

     const cachedRole = (ctx as any).state?.role;
     if (await isAdmin(user.id.toString(), cachedRole)) return next();

     const data = (ctx as any).state?.userRecord;
     // ... rest of Ban Check middleware logic, using `data` directly instead of querying Supabase.
   ```
   - Update `bot.use` impersonation middleware to use `cachedRole` for `isOwner`.
   ```ts
   bot.use(async (ctx, next) => {
     // ...
     const cachedRole = (ctx as any).state?.role;
     if (await isOwner(fromTelegramUserId, cachedRole)) {
       // ...
   ```

4. **Refactor command handlers in `bot/src/index.ts`**:
   - Replace all instances of `isAdmin(ctx.from.id.toString())` with `isAdmin(ctx.from.id.toString(), (ctx as any).state?.role)` across the file.
   - Replace all instances of `getRole(...)` with `getRole(..., (ctx as any).state?.role)` across the file.
   - Specifically search and replace inside: `command('stats')`, `command('ban')`, `command('unban')`, `command('givecredits')`, `command('setplan')`, `command('broadcast')`, `command('health')`, `command('adminhelp')`, `on('message:text')` (broadcast logic), `on('callback_query')` (reply logic).

5. **Testing**: Run `pnpm run typecheck` to verify no types are broken. Ensure the bot still compiles and logic works correctly. Run `node --check src/index.ts` equivalently.
