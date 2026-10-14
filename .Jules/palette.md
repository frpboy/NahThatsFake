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
