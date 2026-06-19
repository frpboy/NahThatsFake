## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## 2026-06-19 - Consolidate Screen Reader Announcements for List Items
**Learning:** Complex vanilla JS list items with multiple inner elements cause fragmented and confusing readouts for screen reader users. The individual texts are read disjointedly.
**Action:** Applied a consolidated, highly descriptive `aria-label` to the parent container (`.check-item`) and set `aria-hidden="true"` on all inner visual or structural child elements (`.check-icon`, `.check-details`, `.check-result`) to ensure a single, clear, and comprehensive announcement.
