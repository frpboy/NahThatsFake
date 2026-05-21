## 2024-11-20 - [CRITICAL] Fix price manipulation vulnerability in TMA backend

**Vulnerability:** IDOR / Price Manipulation in payment endpoints. `req.body.amount` was fully trusted for both `/api/payment/create-razorpay-order` and `/api/payment/create-stars-invoice` without server-side validation.
**Learning:** Payment details, particularly pricing and amounts, cannot be trusted when sourced from the client. The client can intercept the request and change the `amount` field, allowing them to purchase any plan for any arbitrary price (e.g., 1 INR or 1 Star).
**Prevention:** Always maintain an authoritative configuration of prices on the server (like `getPlanDetails`) and only accept the identifier (e.g. `planId`) from the client. Look up the required amounts securely on the backend before creating invoices or orders.
