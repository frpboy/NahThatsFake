## 2024-05-24 - Payment Price Manipulation
**Vulnerability:** The Razorpay and Telegram Stars payment endpoints implicitly trusted the `amount` passed in the `req.body` from the frontend, enabling clients to manipulate prices for premium subscriptions and credits.
**Learning:** Never trust the client with authoritative pricing values. Payment verification workflows must independently reference an internal, secure configuration to determine the expected transaction amount based on the requested resource.
**Prevention:** Implement backend pricing registries (e.g., `getPlanDetails()`) and force transaction options to consume these authoritative values instead of relying on frontend-provided figures.
