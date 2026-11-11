## 2024-11-06 - Localized Feedback over Global Disabling
**Learning:** Users can feel confused if all buttons are globally disabled without inline visual feedback on the specific button they interacted with.
**Action:** When implementing async operations, track the active element and provide localized feedback (e.g., text swap to "Processing...") to explicitly confirm their action.
## 2024-11-11 - Add Chevron Affordance to Interactive List Items
**Learning:** List items in Telegram Mini Apps often lack obvious visual cues that they are clickable, despite having tactile feedback (`:active` styles) or keyboard support.
**Action:** Append a decorative chevron (`›`) with `aria-hidden="true"` and muted styling (`opacity: 0.5`) using `--tg-theme-hint-color` to explicitly communicate interactivity without cluttering the screen reader experience.
