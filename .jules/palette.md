## 2026-10-04 - Native feedback for stubbed interactions
**Learning:** In Telegram Mini Apps, `console.log` is invisible to end users. When interactive elements (like viewing details) are stubbed for future implementation, logging to the console provides zero feedback, leaving users confused about whether their tap registered.
**Action:** Always provide visible UI feedback (such as native `tg.showAlert`) for pending or stubbed interactive elements instead of relying on silent console logs.
