## 2024-05-14 - Replace Silent Console Logs with Native Alerts in TMAs
**Learning:** In Telegram Mini Apps (TMAs), console logs are invisible to the user. Silent logs for pending or interactive elements create a poor user experience as the interface appears unresponsive when interacted with.
**Action:** Always provide visible feedback for pending or stubbed interactions. Use native UI alerts (e.g., `tg.showAlert`) instead of silent console logs so users know their action was registered.
