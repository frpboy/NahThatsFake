## 2026-10-27 - Add interactive states to list items for tactile feedback
**Learning:** List items that function as buttons (`role="button"`) without hover and active states lack critical tactile feedback, making the UI feel unresponsive, especially on touch interfaces where users rely on visual confirmation of their taps.
**Action:** Always include explicitly defined `:active` and `:hover` pseudo-classes for custom interactive elements. Use subtle `background-color` changes and small `transform: scale(0.98)` modifications on click, and wrap `:hover` styles in `@media (hover: hover)` to prevent sticky hover states on mobile devices.
## 2026-10-27 - Inline loading feedback on async buttons
**Learning:** When users click a payment or submission button, globally disabling all buttons without specific visual feedback on the interacted element can make the interface feel unresponsive and confusing.
**Action:** Enhance loading state implementations by tracking the actively clicked button and replacing its content with an inline loading indicator (e.g., "⏳ Processing..."), providing clear visual confirmation of the async process tied directly to user action.
