## 2024-11-06 - Localized Feedback over Global Disabling
**Learning:** Users can feel confused if all buttons are globally disabled without inline visual feedback on the specific button they interacted with.
**Action:** When implementing async operations, track the active element and provide localized feedback (e.g., text swap to "Processing...") to explicitly confirm their action.

## 2024-11-09 - Tactile Feedback for Custom Buttons
**Learning:** Custom interactive elements (like `.btn` without default active styles) feel unresponsive on touch devices if they lack immediate visual feedback on press. Furthermore, applying `:active` styles generically can result in misleading feedback on disabled buttons.
**Action:** Always include `:active` styles (e.g., `transform: scale(0.98)`) for custom buttons to simulate tactile feedback, and ensure the pseudo-class strictly targets `:not(:disabled)` elements.
