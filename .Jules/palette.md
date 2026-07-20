## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## $(date +%Y-%m-%d) - Wrap Decorative Emojis in Buttons
**Learning:** Screen readers verbosely announce decorative emojis in interactive elements (like buttons), leading to poor UX.
**Action:** Wrapped emojis in `<span aria-hidden="true">` within buttons and links to hide them from screen readers while keeping them visible visually.
## $(date +%Y-%m-%d) - Error Container Accessibility
**Learning:** Empty error containers (like `<div id="error"></div>`) that are populated dynamically with JavaScript are not announced by screen readers when their content changes unless they have appropriate ARIA live regions.
**Action:** Added `role="alert" aria-live="assertive"` to the static HTML error container to ensure screen readers immediately announce dynamically injected error messages to the user.
