## 2026-10-04 - Visible feedback for stubbed actions
**Learning:** Silent console.log fallbacks are essentially invisible in Telegram Mini Apps. Interactive elements must provide visual CSS transitions and native UI alerts (e.g., tg.showAlert) to confirm user actions.
**Action:** Always verify that every interactive element has both visual state transitions (hover/active) and actionable UI feedback rather than relying on console logging.
