## 2024-11-06 - Localized Feedback over Global Disabling
**Learning:** Users can feel confused if all buttons are globally disabled without inline visual feedback on the specific button they interacted with.
**Action:** When implementing async operations, track the active element and provide localized feedback (e.g., text swap to "Processing...") to explicitly confirm their action.
## 2024-11-08 - Tactile Feedback for TMA Buttons
**Learning:** The premium upgrade page buttons lacked an `:active` state, making the UI feel unresponsive on touch devices since Telegram Mini Apps are predominantly mobile. The main application CSS (`style.css`) had this implemented, but `premium.html` (which has standalone styles) missed it.
**Action:** Added `.btn:not(:disabled):active` with a slight scale transform to provide immediate tactile feedback on tap.
