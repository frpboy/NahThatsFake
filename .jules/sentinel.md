## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.

## 2024-05-20 - Price Manipulation in Payment Endpoints
**Vulnerability:** The `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` endpoints blindly trusted the `amount` passed in the client's request body when generating payment orders and invoices.
**Learning:** Any data passed from the client, especially financial data like prices or amounts, can be intercepted and manipulated by an attacker before it reaches the server. Relying on client-provided prices is a form of Insecure Direct Object Reference (IDOR) and leads to price manipulation vulnerabilities.
**Prevention:** Never trust client-provided pricing data. Always look up prices server-side using a trusted source of truth (e.g., a database query or a server-side configuration object like `getPlanDetails`) based on the requested item or plan ID.
