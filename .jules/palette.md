## 2024-10-24 - Missing Feedback on List Items
**Learning:** In Telegram Mini Apps, console logs are invisible to users. Interactive UI elements without explicit visual tap states (like `scale`) and explicit functional feedback (like `tg.showAlert`) appear broken, leading to user confusion and repeated tapping.
**Action:** Always provide both visual CSS state transitions and native UI alerts for pending/stubbed interactive elements rather than silent console logs.
