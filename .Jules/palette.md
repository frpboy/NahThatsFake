## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.

## 2026-05-18 - Consolidating Screen Reader Announcements for Complex List Items
**Learning:** For complex interactive list items, multiple separate child elements with text content (like dates, percentages, and icons) can cause a screen reader to read out fragmented and confusing announcements.
**Action:** Consolidate the accessible information by generating a single descriptive `aria-label` string on the interactive parent container (e.g. the `.check-item`) and applying `aria-hidden="true"` to all visual or structural inner child elements. This provides a clear, unified, and understandable single announcement when a user focuses the element.
