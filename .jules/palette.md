## 2026-05-09 - Accessible Interactive Elements in Vanilla JS
**Learning:** When using vanilla HTML/JS without a UI framework, interactive elements like `.check-item` list items often lack native keyboard accessibility (relying only on `onclick`). Screen readers and keyboard navigators are excluded by default.
**Action:** Always verify custom interactive components have `role="button"`, `tabindex="0"`, and keydown handlers supporting `Enter` and `Space`. Adding `:focus-visible` ensures clear visual feedback without compromising mouse users.
## 2024-05-24 - Actionable Empty States
**Learning:** Generic empty states like "No checks yet" lead to dead ends during user onboarding, causing confusion about how to start using the app.
**Action:** Always provide actionable empty states that include a clear explanation and a call-to-action button (like opening the bot chat) to guide users on their next steps. Ensure these states are accessible using `role="status"` and `aria-live="polite"`.
## 2024-05-24 - Async Loading States and A11y for Payment Buttons
**Learning:** Actionable async buttons, especially for payments (like in `premium.html`), often lack `disabled` and `aria-busy` states during processing. This can lead to double-click submissions (double-charges) and leaves screen reader users unaware of the loading state. Furthermore, dynamic status messages need proper ARIA roles to be announced correctly.
**Action:** Always wrap async payment interactions with logic to disable action buttons and set `aria-busy="true"`. Use `role="alert"` + `aria-live="assertive"` for dynamic error messages, and `role="status"` + `aria-live="polite"` for non-critical status updates.
## 2024-05-25 - Consolidate Screen Reader Readouts for Complex List Items
**Learning:** Complex interactive list items (like `.check-item`), when read by screen readers, can result in fragmented and noisy readouts because the reader encounters multiple nested text nodes and emojis sequentially.
**Action:** Always consolidate the information of complex interactive items into a single descriptive string and apply it as an `aria-label` on the parent container (which has `role="button"` or `tabindex="0"`). Set `aria-hidden="true"` on the inner visual/structural elements so the screen reader uses the unified label instead of spelling out the fragmented layout.
