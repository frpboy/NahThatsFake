## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## 2024-05-24 - Screen Reader Emojis
**Learning:** Decorative emojis inside interactive elements like buttons are read aloud by screen readers, which can be verbose and confusing for users.
**Action:** Always wrap decorative emojis within interactive elements (buttons, links) in `<span aria-hidden="true">` to keep screen readers focused on the actionable text.
