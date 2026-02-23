# 🚀 Deployment Guide (Finalized)

This guide covers the deployment of the fully implemented **Nah That's Fake** bot, including the Abuse System and Group Premium features.

## 1. Database Updates (Crucial)
Before starting the bot, you MUST update your Supabase database with the latest migrations.

1.  Go to the **Supabase SQL Editor**.
2.  Run the content of `supabase/migrations/20240526000000_abuse_system.sql` (Abuse Tables).
3.  Run the content of `supabase/migrations/20240527000000_check_expired_premium.sql` (Expiry Logic).

## 2. Environment Variables
Ensure your `.env` files in `bot/` and `tma/` have the following keys:

**bot/.env**
```env
BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OWNER_TELEGRAM_ID=... (Your numeric Telegram ID)
TMA_URL=... (Your deployed TMA URL, e.g., https://your-app.vercel.app)
# Optional APIs
SIGHTENGINE_API_KEY=...
SIGHTENGINE_API_SECRET=...
GOOGLE_SAFE_BROWSING_KEY=...
VIRUSTOTAL_API_KEY=...
```

**tma/.env**
```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
# Telegram Stars
TELEGRAM_BOT_TOKEN=...
```

## 3. Deployment Methods

### Option A: Docker (Recommended for VPS/VM)
This will run both the Bot and the TMA (Mini App) on the same server.

1.  **Upload** the entire project folder to your server.
2.  **Run:**
    ```bash
    docker-compose up -d --build
    ```
3.  **Logs:**
    ```bash
    docker-compose logs -f
    ```

### Option B: Cloud Platforms (Vercel + Railway/Heroku)
*   **TMA (Frontend/API):** Deploy the `tma` folder to **Vercel**.
    *   Set the Root Directory to `tma`.
    *   Add environment variables in Vercel settings.
*   **Bot (Backend):** Deploy the `bot` folder to **Railway**, **Heroku**, or **Render**.
    *   Set the Root Directory to `bot`.
    *   Add environment variables.
    *   Command: `npm start`.

## 4. Post-Deployment Verification
1.  **Check Health:** Send `/health` to the bot (Admin only).
2.  **Verify Admin:** Send `/whoami` to ensure you are recognized as Owner/Admin.
3.  **Test Group Link:**
    *   Add bot to a group.
    *   Run `/linkgroup` (should fail if no plan).
    *   Give yourself a plan: `/setplan <your_id> grp_monthly 30`.
    *   Run `/linkgroup` again (should succeed).

## 5. Abuse System Test
To verify the auto-ban system without waiting:
1.  Manually insert a flag in Supabase:
    ```sql
    INSERT INTO abuse_flags (user_id, flag_type, details) 
    VALUES ('<target_user_uuid>', 'manual_test', '{"test": true}');
    ```
2.  Or spam the bot (if you are not Owner/Admin) to trigger rate limits.
