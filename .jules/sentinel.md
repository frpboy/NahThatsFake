## 2024-05-07 - Server-Side Payment Amount Validation
**Vulnerability:** Arbitrary price manipulation in `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` where the client provided the `amount` field.
**Learning:** Never trust client input for payment amounts. The server must strictly validate and fetch the price details associated with a given `planId` server-side to prevent exploitation.
**Prevention:** Remove `amount` parameters from client requests and use server-side mapping mechanisms (like `getPlanDetails()`) to look up the expected amount for an order/invoice.

## 2024-05-07 - Admin Endpoint Authorization Verification
**Vulnerability:** Missing authorization check on `/api/admin/stats` allowed any authenticated user to view sensitive statistics.
**Learning:** Endpoints returning sensitive or administrative data require robust authorization checks, not just authentication verification.
**Prevention:** Always verify a user's role (e.g. `owner` or `admin`) before querying or returning sensitive backend data, falling back to environment-based owners when appropriate.
