## 2024-05-08 - Accessible Pseudo-buttons
**Learning:** Interactive `div` elements used as list items (e.g., `div.check-item` with `onclick`) completely fail screen readers and keyboard users. Adding a cursor and hover isn't enough; they are fundamentally inaccessible out of the box.
**Action:** When forced to use a `div` as a button, always implement the full interaction suite: `role="button"`, `tabindex="0"`, a meaningful `aria-label`, an `onkeydown` handler for Enter/Space keys to trigger the action, and explicit `:hover` and `:focus-visible` styles for visual feedback.
