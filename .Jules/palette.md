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
## 2024-05-19 - Semantic Headings in App Views
**Learning:** Single-page app views and embedded widgets often lack a root `<h1>` element, which degrades the document outline and navigation for screen reader users. Simply styling `div` elements to look large does not convey structural meaning.
**Action:** Converted main brand elements (`.logo`, `.subtitle`) to semantic `<h1>` and `<h2>` tags to establish a clear header hierarchy without altering the visual design.
