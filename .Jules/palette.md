## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## 2026-05-07 - Decorative Emojis in Interactive Elements
**Learning:** Found that decorative emojis within interactive elements (like `<button>` or `<a>`) are verbosely read out by screen readers (e.g., "rocket open in telegram"), which adds noise and degrades the accessibility experience.
**Action:** Wrapped decorative emojis in these elements with `<span aria-hidden="true">` to hide them from the accessibility tree, allowing the screen reader to only announce the meaningful text label.
