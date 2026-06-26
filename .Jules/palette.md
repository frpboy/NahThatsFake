## 2026-05-07 - Async Button State Improvements
**Learning:** Found that long-running network requests (like loading paginated check history) lack visual feedback during the loading phase. This can cause duplicate submissions and confusion.
**Action:** Implemented a standard async loading state for the 'Load More' button that disables the button, updates text to 'Loading...', and adds `aria-busy="true"`. Also introduced `.button:disabled` states in CSS to ensure the UI clearly reflects when buttons are inactive.
## 2026-06-26 - Eliminate Flash of Empty State (FOES)
**Learning:** Hardcoding an empty state (like "No checks yet") in the static HTML for dynamically populated areas causes a jarring "Flash of Empty State" (FOES) for returning users while data loads.
**Action:** Always default to a neutral, generic loading state (e.g., "Loading...") in the initial HTML for dynamic containers. Rely on the JavaScript logic to explicitly inject the true empty state UI only after the data fetch confirms there are zero items.
