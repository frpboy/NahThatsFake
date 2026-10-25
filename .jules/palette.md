## 2026-10-04 - Check Item Tactile Feedback
**Learning:** List items that act as clickable regions (`role="button"`) feel unresponsive in Telegram Mini Apps without explicit visual feedback on interaction. The list of recent checks lacked `:hover` and `:active` states, making them feel like static text rather than tappable elements.
**Action:** Always add subtle background color changes on hover (wrapped in `@media (hover: hover)` to prevent sticky mobile hovers) and slight scaling on active states (`transform: scale(0.98)`) for custom list item buttons to provide proper tactile UI feedback.
