## 2026-10-27 - Add interactive states to list items for tactile feedback
**Learning:** List items that function as buttons (`role="button"`) without hover and active states lack critical tactile feedback, making the UI feel unresponsive, especially on touch interfaces where users rely on visual confirmation of their taps.
**Action:** Always include explicitly defined `:active` and `:hover` pseudo-classes for custom interactive elements. Use subtle `background-color` changes and small `transform: scale(0.98)` modifications on click, and wrap `:hover` styles in `@media (hover: hover)` to prevent sticky hover states on mobile devices.
## 2026-10-27 - Add visible native UI alerts for stubbed interactions
**Learning:** Console logs are invisible to users in Telegram Mini Apps. When interactive elements (like list items) rely solely on `console.log` for stubbed actions, the app provides no feedback and feels broken or unresponsive to users tapping them.
**Action:** Always provide visible UI feedback for pending or stubbed interactive elements, for example by triggering a native UI alert (`tg.showAlert`) instead of a silent console log.
