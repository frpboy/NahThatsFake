## 2026-10-27 - Add interactive states to list items for tactile feedback
**Learning:** List items that function as buttons (`role="button"`) without hover and active states lack critical tactile feedback, making the UI feel unresponsive, especially on touch interfaces where users rely on visual confirmation of their taps.
**Action:** Always include explicitly defined `:active` and `:hover` pseudo-classes for custom interactive elements. Use subtle `background-color` changes and small `transform: scale(0.98)` modifications on click, and wrap `:hover` styles in `@media (hover: hover)` to prevent sticky hover states on mobile devices.
## 2024-11-03 - Localized Loading Feedback for Async Operations
**Learning:** Globally disabling buttons without localized feedback leaves users wondering if their action was registered, especially for payment flows.
**Action:** Use a capturing event listener (`document.addEventListener('click', handler, true)`) to track the exact clicked element (`activePaymentBtn`) before globally-scoped logic disables the interface, allowing inline visual feedback to be applied specifically to the triggered button.

## 2024-11-03 - Preserving Inner HTML for Localized Loading
**Learning:** When saving the original content of a button to restore it after a loading state, using `textContent` will strip out any child HTML tags (like span or icons).
**Action:** Use `innerHTML` to save and restore complex button content instead of `textContent`.
