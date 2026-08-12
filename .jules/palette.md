## 2026-05-09 - Accessible Interactive Elements in Vanilla JS
**Learning:** When using vanilla HTML/JS without a UI framework, interactive elements like `.check-item` list items often lack native keyboard accessibility (relying only on `onclick`). Screen readers and keyboard navigators are excluded by default.
**Action:** Always verify custom interactive components have `role="button"`, `tabindex="0"`, and keydown handlers supporting `Enter` and `Space`. Adding `:focus-visible` ensures clear visual feedback without compromising mouse users.
## 2024-05-24 - Actionable Empty States
**Learning:** Generic empty states like "No checks yet" lead to dead ends during user onboarding, causing confusion about how to start using the app.
**Action:** Always provide actionable empty states that include a clear explanation and a call-to-action button (like opening the bot chat) to guide users on their next steps. Ensure these states are accessible using `role="status"` and `aria-live="polite"`.
## 2024-05-24 - Async Loading States and A11y for Payment Buttons
**Learning:** Actionable async buttons, especially for payments (like in `premium.html`), often lack `disabled` and `aria-busy` states during processing. This can lead to double-click submissions (double-charges) and leaves screen reader users unaware of the loading state. Furthermore, dynamic status messages need proper ARIA roles to be announced correctly.
**Action:** Always wrap async payment interactions with logic to disable action buttons and set `aria-busy="true"`. Use `role="alert"` + `aria-live="assertive"` for dynamic error messages, and `role="status"` + `aria-live="polite"` for non-critical status updates.
## 2024-05-24 - Consolidate screen reader announcements for check items
**Learning:** Complex interactive items (like the list of recent checks) built with nested `div`s can fragment screen reader announcements if inner nodes containing text are read sequentially without context.
**Action:** Always apply a single, concise `aria-label` summarizing the interactive element's entire content to the parent container (along with `role="button"` and `tabindex`), and explicitly set `aria-hidden="true"` on inner child structural elements to suppress duplicate, fragmented readouts.
## 2024-10-25 - Contextual ARIA labels on payment buttons
**Learning:** Generic button text like "Pay ₹29" creates a poor experience for screen reader users navigating by interactive elements, as they lose the context of the plan name.
**Action:** Always add descriptive `aria-label`s to payment buttons that include the item being purchased.
## 2024-10-25 - Semantic Heading Hierarchy
**Learning:** Using `div`s for section titles (e.g., `<div class="section-title">`) or skipping heading levels (e.g., jumping from `h1` directly to `h3`) breaks the document outline. This makes it difficult for screen reader users to navigate the page structure efficiently.
**Action:** Always use semantic HTML heading tags (`h1` through `h6`) in a logical, sequential order to create a clear document outline. Avoid skipping levels for styling purposes.
## 2024-11-28 - Semantic Hierarchy in Flex Layouts
**Learning:** Using `<span>` for card titles breaks semantic document outlines for screen reader users, preventing them from navigating by headers. However, simply converting inline elements to `<h3>` inside flexbox layouts can break the visual design if default margins aren't explicitly reset.
**Action:** Always use semantic heading tags (like `<h3>`) for card titles to improve accessibility. When doing so inside flex containers, remember to add `margin: 0;` to prevent layout breakage.
