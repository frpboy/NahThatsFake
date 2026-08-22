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
## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## $(date +%Y-%m-%d) - Wrap Decorative Emojis in Buttons
**Learning:** Screen readers verbosely announce decorative emojis in interactive elements (like buttons), leading to poor UX.
**Action:** Wrapped emojis in `<span aria-hidden="true">` within buttons and links to hide them from screen readers while keeping them visible visually.
## $(date +%Y-%m-%d) - Error Container Accessibility
**Learning:** Empty error containers (like `<div id="error"></div>`) that are populated dynamically with JavaScript are not announced by screen readers when their content changes unless they have appropriate ARIA live regions.
**Action:** Added `role="alert" aria-live="assertive"` to the static HTML error container to ensure screen readers immediately announce dynamically injected error messages to the user.
## 2024-05-19 - Added Actionable Recovery Step to Error State
**Learning:** For frontend applications fetching state, dynamically injected error states lacking recovery steps (like a "Try Again" reload button) can leave users stuck, especially since empty states can be hard to escape natively in embedded miniapps without hard refreshes. Constructing complex DOM elements programmatically via `document.createElement` prevents XSS while maintaining clean markup without inline CSS hacks.
**Action:** When adding error state components, explicitly include user-facing actions to retry or recover, constructed using safe DOM manipulation primitives rather than `innerHTML`.
## 2024-05-18 - Missing ARIA attributes for dynamically injected errors
**Learning:** Found an error container in `index.html` that had `role="alert"` and `aria-live="assertive"` initially, but `premium.html` has an error/status container without these initial attributes (`<div id="status-message" class="hidden"></div>`). The JS sets these dynamically later on, but it's better for accessibility if the container has these statically in HTML or at least ensures screen readers are aware of it properly.
**Action:** Enhance accessibility by ensuring status/error messages are properly announced.
## 2024-05-24 - Accessible Error States
**Learning:** Emojis injected dynamically into error/loading states need `aria-hidden="true"` just as much as static HTML emojis to prevent screen readers from reading them out verbosely during critical status updates.
**Action:** Always wrap emojis in `<span aria-hidden="true">` when dynamically creating UI elements like buttons or alerts in JS.
## 2024-05-24 - Actionable Localized Error States
**Learning:** When a nested async component (like a list of recent checks) fails to load, showing a static error message leaves the user stuck. Implementing localized, actionable recovery steps (like a "Try Again" button) using safe DOM manipulation prevents user frustration and avoids the need for a full app reload.
**Action:** Always provide localized retry mechanisms for independent async UI components, avoiding `innerHTML` when creating dynamic interactive elements to ensure security and accessibility.
## 2024-08-04 - Improve Risk Badge Contrast
**Learning:** Default Material Design 500-level colors on 10% opacity backgrounds fail WCAG AA contrast for text.
**Action:** Use 700-level colors for light mode and keep 300-level or 500-level for dark mode to ensure text is readable.
## 2024-08-22 - CSS Grid Odd Items Balancing
**Learning:** In a 2-column CSS grid with an odd number of items, the last item visually hangs and unbalances the layout.
**Action:** Used `:nth-child(odd):last-child { grid-column: 1 / -1; }` to make the final hanging element gracefully span the full width of the grid, maintaining visual symmetry.
