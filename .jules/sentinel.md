## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.

## 2024-05-18 - [CRITICAL] Price Manipulation IDOR in Payments
**Vulnerability:** The payment endpoints (`/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice`) blindly trusted the `amount` parameter provided by the client in the request body. A malicious user could tamper with the payload (e.g., changing ₹9900 to ₹100 or 500 Stars to 1 Star) and the backend would create valid orders/invoices for the manipulated amount, resulting in subscription/credit grants for a fraction of the actual cost.
**Learning:** Never trust client-provided pricing data. Even if the frontend UI displays a fixed price, an attacker can intercept the API request or construct their own using tools like Postman/Burp Suite.
**Prevention:** Always enforce authoritative pricing logic on the server. Retrieve the correct price/amount by looking up the requested `planId` from a secure backend configuration (`getPlanDetails()`) and use that value for creating external payment sessions. Ensure the frontend only provides identifiers (`planId`), not values.
