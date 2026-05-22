## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.
## 2024-05-31 - [CRITICAL] Price Manipulation IDOR in Payment Endpoints
**Vulnerability:** Payment creation endpoints (`/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice`) trusted the `amount` value provided by the client in `req.body` rather than looking it up based on the `planId`. This allowed malicious actors to purchase any premium tier for arbitrary amounts (e.g., 1 Star or 1 INR).
**Learning:** Never trust client-provided pricing data. Even if the frontend correctly maps the plan ID to the price, an attacker can bypass the frontend and send a direct API request with manipulated values.
**Prevention:** Always use a server-side authoritative source of truth for pricing (like a configuration object or database lookup based on a plan ID) when creating payment orders or invoices.
