# Error reporting source review, not deployed

Baseline: main 48d23fcb57748308b059a6ca764468d79d2c36bd. This local patch is not permission to deploy.

## Scope

- Node bot and Express server use pinned @sentry/node 10.78.0.
- Browser uses pinned @sentry/browser 10.78.0, bundled locally into a same-origin script. No third-party recording script is added by this change.
- A fixed generic message, fixed app/runtime/boundary tags, generated event identifier, timestamp and grouping fingerprint are allowed. SDK name/version metadata is added by the SDK after the hook. Raw errors, stack frames, requests, user objects, URLs, free-form tags/context, breadcrumbs and hint attachments are discarded at the final error hook.
- Native Node reporting starts in production only. Browser reporting starts only in the explicit production bundle; source/development is inert. Docker explicitly sets NODE_ENV=production after dependency installation/build. The SDK installs only fatal-exception/rejection handlers. Browser installs only global error/rejection handlers. No replay, tracing, profiling, request instrumentation, console collection or default integration bundle.
- Caught Express errors and selected scheduler errors produce generic boundary events. Caught-server flush is bounded to 500ms before the existing response. Webhook return200 behavior is unchanged and is not proof of fulfillment.
- No bot token, Telegram update, user content, payment payload or Supabase error object is passed to reporting.

## Limits

This is an intentionally coarse diagnostic signal, not a useful raw stack trace. It cannot identify the failing source line. The data recipient still sees network metadata necessary to receive the event, such as the sending connection's source IP; an event-body scrub is not a claim that the vendor receives no personal information. Existing console logs remain unchanged and outside this patch.

Bot errors caught internally by handlers/providers may still not reach the global boundary. Scheduler RPCs that return errors without throwing are not all audited. Browser handled fetch failures are not yet explicitly captured. Server startup before the monitoring module loads, OS/native termination and offline loss are not guaranteed. Ingesting one labeled SDK test does not qualify actual deployed bot/server/browser paths.

No source-map upload/auth token, service settings, production environment or deployment changes are included. Before publishing a branch, verify Vercel/Git coupling and install a reviewed branch-only no-deploy guard first if needed.

## Qualification performed locally

- TypeScript production bot build; existing markdown and URL-scanner tests.
- Actual Node SDK final envelopes seeded with user/request/query/stack/extra/context/tag/breadcrumb/attachment canaries, plus fixed-boundary allowlist.
- Fatal throw and rejection subprocesses both exit1 and emit sanitized envelopes, for bot-compiled TS and server JS.
- Actual built browser bundle in headless Chrome: uncaught exception and unhandled rejection emit generic envelopes; URL/query/fragment/error/console/DOM canaries absent.
- One local actual Node SDK qualification event reached project nahthatsfake and was read back by event ID ff4a44396bcf4d61acb9e7a389131778. Not an in-app or deployed test.

## Privacy wording to review with the whole app policy

The source change adds automatic limited reliability reports to Sentry's US ingestion service. It sends a generic error label, an allow-listed component/boundary, event time and a random event identifier, with SDK version information. It does not add session recording. Sentry's current Developer plan retains error events for30 days; other logs, support files, backups and copies have separate policies. The organization shares a free 5,000-error monthly quota, after which errors may be dropped. This wording describes the proposed patch, not today's deployed build.

Node20 default fatal uncaught/rejection behavior was checked against the baseline process: both exit1. The explicit SDK strict rejection handler retains that fail-fast outcome. It does not add a bot.catch that would keep a failed bot running.
