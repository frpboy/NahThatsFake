const Sentry = require('@sentry/node');
const DSN = 'https://c5b3504a11565ca803b515b6555c3379@o4510460282601472.ingest.us.sentry.io/4512436387053568';
const BOUNDARIES = new Set([
  'unhandled', 'bot.handler', 'bot.start', 'bot.scheduler.hourly',
  'bot.scheduler.expiry', 'bot.scheduler.daily', 'api.stats', 'api.profile',
  'api.role', 'api.checks', 'api.order', 'api.payment-update',
  'api.invoice', 'api.webhook', 'api.unhandled', 'qualification'
]);
let active = false;
function safeEvent(event, hint) {
  if (hint) hint.attachments = [];
  const boundary = BOUNDARIES.has(event.tags?.boundary) ? event.tags.boundary : 'unhandled';
  return {
    event_id: /^[a-f0-9]{32}$/.test(event.event_id || '') ? event.event_id : undefined,
    timestamp: Date.now() / 1000,
    type: undefined,
    level: event.level === 'fatal' ? 'fatal' : 'error',
    message: 'NahThatsFake application error',
    tags: { app: 'nahthatsfake', runtime: 'server', boundary },
    fingerprint: ['nahthatsfake', boundary],
  };
}
function initReporting(options = {}) {
  if (active) return;
  const enabled = options.enabled ?? process.env.NODE_ENV === 'production';
  if (!enabled) return;
  try {
    Sentry.init({
      dsn: DSN,
      defaultIntegrations: false,
      integrations: [
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.onUnhandledRejectionIntegration({ mode: 'strict' }),
      ],
      sendDefaultPii: false,
      includeLocalVariables: false,
      attachStacktrace: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      enableLogs: false,
      sendClientReports: false,
      beforeSend: safeEvent,
      beforeSendTransaction: () => null,
      ...options.transport && { transport: options.transport },
    });
    active = true;
  } catch (_) {
    // Reporting must not prevent application startup.
  }
}
async function reportError(boundary) {
  if (!active || !BOUNDARIES.has(boundary)) return;
  try {
    Sentry.captureEvent({ level: 'error', message: 'NahThatsFake application error', tags: { boundary } });
    // SDK timeout arguments are not a wall-clock deadline for arbitrary work.
    let timer;
    try {
      await Promise.race([
        Promise.resolve(Sentry.flush(500)).catch(() => false),
        new Promise(resolve => { timer = setTimeout(() => resolve(false), 500); }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (_) {
    // Reporting must not change the handled operation's result.
  }
}
module.exports = { initReporting, reportError, safeEvent, flush: timeout => Sentry.flush(timeout) };
