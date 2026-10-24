## 2024-05-14 - Empty State Actionability
**Learning:** Empty states without a clear call-to-action leave users stranded, requiring them to hunt for the next step.
**Action:** Always include a helpful CTA button in empty states to guide the user seamlessly to the next logical action (e.g., opening the bot chat to create their first check).

## 2024-05-14 - Silent Console Logs
**Learning:** In Telegram Mini Apps, console logs are invisible to users, making pending or stubbed interactions seem unresponsive when clicked.
**Action:** Always provide visual CSS state transitions and native UI alerts (e.g., `tg.showAlert`) for pending/stubbed interactive elements instead of relying on silent console logs.
