## 2026-05-09 - Accessible Interactive Elements in Vanilla JS
**Learning:** When using vanilla HTML/JS without a UI framework, interactive elements like `.check-item` list items often lack native keyboard accessibility (relying only on `onclick`). Screen readers and keyboard navigators are excluded by default.
**Action:** Always verify custom interactive components have `role="button"`, `tabindex="0"`, and keydown handlers supporting `Enter` and `Space`. Adding `:focus-visible` ensures clear visual feedback without compromising mouse users.
## 2024-05-24 - Actionable Empty States
**Learning:** Generic empty states like "No checks yet" lead to dead ends during user onboarding, causing confusion about how to start using the app.
**Action:** Always provide actionable empty states that include a clear explanation and a call-to-action button (like opening the bot chat) to guide users on their next steps. Ensure these states are accessible using `role="status"` and `aria-live="polite"`.
## 2024-05-24 - Async Loading States and A11y for Payment Buttons
**Learning:** Actionable async buttons, especially for payments (like in `premium.html`), often lack `disabled` and `aria-busy` states during processing. This can lead to double-click submissions (double-charges) and leaves screen reader users unaware of the loading state. Furthermore, dynamic status messages need proper ARIA roles to be announced correctly.
**Action:** Always wrap async payment interactions with logic to disable action buttons and set `aria-busy="true"`. Use `role="alert"` + `aria-live="assertive"` for dynamic error messages, and `role="status"` + `aria-live="polite"` for non-critical status updates.

## $(date +%Y-%m-%d) - Consolidating Complex Interactive List Items
**Learning:** In the TMA dashboard, the "recent checks" list items (`.check-item`) contained multiple text nodes and spans (check type, date, risk badge, score). When interactive elements (like a list item with `onclick` and `role="button"`) contain multiple disjointed child nodes without a single container label, screen readers will fragment the announcement (e.g., reading "Link Analysis", then pausing, then "4/24/2024", etc.), which is confusing and verbose.
**Action:** When creating complex interactive cards or list items, combine the relevant information into a single, concise `aria-label` on the parent container, and add `aria-hidden="true"` to the inner visual/structural wrappers to ensure the screen reader announces a single, coherent string (e.g., "Image Analysis on 4/24/2024, risk level HIGH, score 95%").
