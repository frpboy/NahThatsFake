## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.
## 2025-02-28 - [Sentinel] Prevent Payment Price Manipulation
**Vulnerability:** The backend endpoints for creating payment invoices (`/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice`) were trusting the `amount` passed from the frontend request body, rather than looking it up authoritatively on the server. This created an Insecure Direct Object Reference (IDOR) where users could manipulate network requests to purchase high-tier plans for minimal cost.
**Learning:** Never trust client assertions of pricing parameters or metadata for payment fulfillment.
**Prevention:** Always enforce server-side price mapping (e.g. `planDetails.amount`, `planDetails.stars`) using verified logic and schemas before executing payment API calls or fulfilling service limits.
