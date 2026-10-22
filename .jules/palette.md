## 2024-05-24 - Accessibility improvements
**Learning:** Found some missing accessibility roles in app.js
**Action:** Always add ARIA roles to interactive elements in JS generated DOM elements.

## 2024-05-24 - Interactive List States
**Learning:** In Telegram Mini Apps, interactive list items (`role="button"`) often lack desktop hover and mobile active tap states, making the interface feel unresponsive compared to native UI.
**Action:** Always add subtle `background-color` transitions for `:hover` (in `@media (hover: hover)`) and `:active` states on custom list items to provide immediate tactile feedback.
