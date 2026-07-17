## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## 2024-07-17 - Add aria-hidden to decorative button emojis
**Learning:** Screen readers announce decorative emojis in interactive UI elements (like buttons) verbosely.
**Action:** Wrap the emojis in `<span aria-hidden="true">` to prevent screen readers from verbosely announcing them.
