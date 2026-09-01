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
## 2025-02-18 - Semantic Headings in Flexbox Layouts
**Learning:** Replacing non-semantic inline elements (like `<span>`) with heading elements (like `<h3>`) within flexbox or grid layouts can break the alignment due to default browser margins on headings.
**Action:** When improving semantic accessibility by upgrading to heading elements in structured layouts, always explicitly reset the margins (e.g., `margin: 0;`) on the new headings to maintain visual parity.
## 2024-08-27 - Balance Grid Layouts
**Learning:** 2-column grid layouts look unbalanced when they have an odd number of items, leaving dangling single items in the last row.
**Action:** Always use `:nth-child(odd):last-child { grid-column: 1 / -1; }` on children to ensure odd items take full width and maintain symmetry.
## 2024-05-18 - Styled unstyled status toast
**Learning:** In premium.html, the status toast was applying a `.status` class that didn't exist in the CSS, rendering plain black unstyled text for important loading/success states.
**Action:** Added `.status` class utilizing theme colors (`var(--tg-theme-button-color)`) to provide proper visual polish and contrast for informative/success messages, improving the interaction polish.
