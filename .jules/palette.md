## 2023-10-26 - Add visual feedback for pending interactive elements
**Learning:** Silent `console.log` statements for pending interactions in Telegram Mini Apps provide zero user feedback because console logs are invisible to end-users. This causes users to click items repeatedly thinking the app is broken or frozen.
**Action:** Always replace or augment developer-focused `console.log` stubs with native `tg.showAlert` or visual CSS state transitions for interactive elements that are still under development to provide immediate, accessible feedback.
