## 2024-10-24 - Interactive Element Feedback in TMAs
**Learning:** In Telegram Mini Apps, `console.log` is invisible to users, making stubbed or pending interactions appear broken if they lack visible feedback. Interactive list items without touch state changes also feel unresponsive.
**Action:** Always pair stubbed logic with native UI alerts (e.g., `tg.showAlert`) and ensure all interactive elements have visual state transitions (like active transforms) to maintain an intuitive interface.
