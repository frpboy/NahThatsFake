## 2024-11-06 - Localized Feedback over Global Disabling
**Learning:** Users can feel confused if all buttons are globally disabled without inline visual feedback on the specific button they interacted with.
**Action:** When implementing async operations, track the active element and provide localized feedback (e.g., text swap to "Processing...") to explicitly confirm their action.
## 2024-11-07 - Add active state for touch devices
**Learning:** Custom UI buttons without `:active` pseudo-classes feel unresponsive on mobile and touch devices.
**Action:** Always include `:active` states (e.g., `.btn:not(:disabled):active` with `transform: scale(0.98)`) for custom interactive elements to provide tactile feedback.
