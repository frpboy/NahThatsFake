## 2026-10-04 - Screen Reader Support for Loading States
**Learning:** While `role="status"` is helpful, explicitly adding `aria-live="polite"` to loading indicators ensures that screen readers dynamically announce the loading state without interrupting the user's current activity.
**Action:** Always pair `role="status"` with `aria-live="polite"` for primary loading states to guarantee reliable screen reader announcements.
