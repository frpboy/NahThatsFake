## 2023-10-23 - Interactive States and User Feedback in Mini Apps
**Learning:** In Telegram Mini Apps, console logs are invisible to users, and custom list items (`role="button"`) lacking tactile feedback (like `:hover` and `:active` states) feel unresponsive. Silent stubs lead to user confusion.
**Action:** Always provide explicit visual CSS state transitions (e.g., `transform: scale(0.98)`) and native UI alerts (e.g., `tg.showAlert`) for pending or stubbed interactive elements to ensure clear communication and tactile feedback.
