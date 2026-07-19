## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## $(date +%Y-%m-%d) - Wrap Decorative Emojis in Buttons
**Learning:** Screen readers verbosely announce decorative emojis in interactive elements (like buttons), leading to poor UX.
**Action:** Wrapped emojis in `<span aria-hidden="true">` within buttons and links to hide them from screen readers while keeping them visible visually.
## 2026-05-18 - Avoid Flash of Empty State (FOES)
**Learning:** Found that statically placing an empty state ("No checks yet") in HTML causes a Flash of Empty State (FOES) when dynamic content is loading. This creates structural fragility if the list transitions between populated and empty.
**Action:** Replaced dynamic `innerHTML` empty-state injections with a static loading indicator ("Loading...") and relied on dynamic JavaScript (`app.js`) to render the true empty state or the populated list after data is fetched.
