## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.

## 2024-05-29 - Client-Side Price Manipulation in Payments
**Vulnerability:** The endpoints `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` accepted the `amount` parameter directly from the client request body, trusting the client to provide the correct price for a given `planId`. This allowed a malicious user to manipulate the `amount` to an arbitrarily low value (e.g., 1 paisa or 1 star) while receiving the full benefits of the plan.
**Learning:** Never trust the client with authoritative billing amounts or pricing data. The client should only dictate *what* they intend to buy (the `planId`), and the server must determine *how much* it costs based on a trusted server-side source of truth.
**Prevention:** Enforce server-side pricing lookups for all payment integrations. Extract only the product identifier from the client request, retrieve the true price from the database or a hardcoded configuration block, and use that server-side value to initiate the transaction with the payment provider.
