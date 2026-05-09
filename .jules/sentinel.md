## 2024-05-09 - Fix IDOR in user endpoints
**Vulnerability:** Insecure Direct Object Reference (IDOR) via `req.query.userId` fallback. Authenticated endpoints allowed accessing other users' data by providing a `userId` query parameter if the `telegramUser` context was somehow bypassed or when Telegram verification was skipped in development logic.
**Learning:** Even with an authentication middleware, relying on query or body parameters instead of the securely extracted token/header data can create critical access control vulnerabilities.
**Prevention:** Strictly rely on the validated user identity attached by the authentication middleware (`req.telegramUser.id`). Never allow fallbacks to user-provided data for identity verification on protected endpoints.

## 2024-05-07 - Server-Side Payment Amount Validation
**Vulnerability:** Arbitrary price manipulation in `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` where the client provided the `amount` field.
**Learning:** Never trust client input for payment amounts. The server must strictly validate and fetch the price details associated with a given `planId` server-side to prevent exploitation.
**Prevention:** Remove `amount` parameters from client requests and use server-side mapping mechanisms (like `getPlanDetails()`) to look up the expected amount for an order/invoice.

## 2024-05-07 - Admin Endpoint Authorization Verification
**Vulnerability:** Missing authorization check on `/api/admin/stats` allowed any authenticated user to view sensitive statistics.
**Learning:** Endpoints returning sensitive or administrative data require robust authorization checks, not just authentication verification.
**Prevention:** Always verify a user's role (e.g. `owner` or `admin`) before querying or returning sensitive backend data, falling back to environment-based owners when appropriate.
