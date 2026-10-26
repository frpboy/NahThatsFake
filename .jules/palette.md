## 2024-05-24 - Add tactile feedback to custom list items
**Learning:** Custom interactive elements like list items (using `role="button"`) often lack tactile feedback, making them feel unresponsive compared to native buttons. Implementing `:hover` (wrapped in `@media (hover: hover)` for touch friendliness) and `:active` states with subtle background/scaling creates a much better tactile UX.
**Action:** Always add explicit interaction states (`:hover` and `:active`) to custom interactive components that act as buttons to provide immediate tactile feedback.
