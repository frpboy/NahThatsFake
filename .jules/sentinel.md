## 2024-05-09 - Fix IDOR in user endpoints
**Vulnerability:** Insecure Direct Object Reference (IDOR) via `req.query.userId` fallback. Authenticated endpoints allowed accessing other users' data by providing a `userId` query parameter if the `telegramUser` context was somehow bypassed or when Telegram verification was skipped in development logic.
**Learning:** Even with an authentication middleware, relying on query or body parameters instead of the securely extracted token/header data can create critical access control vulnerabilities.
**Prevention:** Strictly rely on the validated user identity attached by the authentication middleware (`req.telegramUser.id`). Never allow fallbacks to user-provided data for identity verification on protected endpoints.
