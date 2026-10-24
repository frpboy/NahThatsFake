## 2024-10-24 - Custom interactive list items lack tactile feedback
**Learning:** Custom interactive elements (like `div` with `role="button"`) in this TMA often have `cursor: pointer` but lack visual hover/active states, making them feel unresponsive, especially on touch devices where native buttons provide default feedback.
**Action:** Always include `:hover` (wrapped in `@media (hover: hover)`) and `:active` styles (e.g. `transform: scale(0.98)`, opacity changes) for `.check-item` and similar custom interactive list items to ensure they feel tactile and responsive like native buttons.
