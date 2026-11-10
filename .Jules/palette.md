## 2024-11-06 - Localized Feedback over Global Disabling
**Learning:** Users can feel confused if all buttons are globally disabled without inline visual feedback on the specific button they interacted with.
**Action:** When implementing async operations, track the active element and provide localized feedback (e.g., text swap to "Processing...") to explicitly confirm their action.

## 2024-11-10 - Active State Tactile Feedback
**Learning:** Custom buttons can feel unresponsive on touch devices if they lack explicit visual feedback upon tap.
**Action:** Always include a `:active` style with `transform: scale(0.98)` or similar subtle interaction to mimic tactile response.
