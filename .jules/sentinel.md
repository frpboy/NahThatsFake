## 2024-05-18 - Authorization Bypass in Admin Stats Endpoint
**Vulnerability:** The `/api/admin/stats` endpoint lacked role verification, allowing any authenticated user to access sensitive admin-level statistics (user count, banned count, checks count, and revenue data).
**Learning:** Authentication (validating who the user is) does not equal authorization (validating what the user is allowed to do). Even with `validateTelegramData` ensuring the user was authenticated via Telegram, the endpoint failed to verify if that user had admin privileges.
**Prevention:** For any endpoint serving sensitive data or administrative functions, explicitly check the user's role (e.g., against `process.env.OWNER_TELEGRAM_ID` or a database role column) in addition to basic authentication. Return a 403 Forbidden status if the user lacks the required role.

## 2024-05-18 - IDOR in Payment Endpoints
**Vulnerability:** The payment endpoints `/api/payment/create-razorpay-order`, `/api/payment/verify-razorpay`, and `/api/payment/create-stars-invoice` trusted the `userId` provided in the JSON body (`req.body.userId`) instead of verifying the authenticated user.
**Learning:** Even if the frontend passes the correct `userId`, the backend must never trust client-provided IDs for sensitive operations. It must extract the `userId` from the authenticated session/token (in this case, via the `validateTelegramData` middleware and `req.telegramUser.id`).
**Prevention:** Always apply the authentication middleware (`validateTelegramData`) to sensitive endpoints and strictly use `req.telegramUser.id` for any database or payment actions linked to a user account.

## 2024-06-03 - Price Manipulation in Payment Creation Endpoints
**Vulnerability:** The `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` endpoints blindly trusted the `amount` field provided by the client in the request body to create payment orders/invoices. An attacker could bypass subscriptions or modify prices by intercepting the request and sending a lower amount.
**Learning:** Never trust client-provided financial data (e.g., prices, amounts) in backend requests, especially for payment creation. Clients can easily manipulate JSON payloads.
**Prevention:** Derive the required amount for an order/invoice directly from a trusted server-side source or configuration mapping based on the `planId` requested. Use mappings (like `starsAmountMap`) and helper functions (like `getPlanDetails()`) to validate the `planId` and fetch the accurate price.
## 2024-06-05 - Fix timing attack vulnerability in signature verification
**Vulnerability:** Found a timing attack vulnerability where HMAC signatures were being compared using `===`. This allowed an attacker to guess a signature by sending many requests and measuring the time it took for the server to reject the request.
**Learning:** HMAC signatures should always be compared using `crypto.timingSafeEqual()` instead of standard equality operators (`===`) to prevent timing attacks. Additionally, when doing this, inputs must be explicitly cast to strings, converted to Buffers, and their lengths checked before calling `timingSafeEqual` to prevent `RangeError` exceptions.
**Prevention:** Always use `crypto.timingSafeEqual()` for comparing sensitive tokens, signatures, or passwords. Ensure you do length checks before passing buffers to `timingSafeEqual`.
