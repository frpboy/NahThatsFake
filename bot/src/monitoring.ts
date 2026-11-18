import * as Sentry from '@sentry/node';
import type { ErrorEvent, EventHint, NodeOptions } from '@sentry/node';
const DSN = 'https://c5b3504a11565ca803b515b6555c3379@o4510460282601472.ingest.us.sentry.io/4512436387053568';
const BOUNDARIES = new Set([
  'unhandled', 'bot.handler', 'bot.start', 'bot.scheduler.hourly',
  'bot.scheduler.expiry', 'bot.scheduler.daily', 'api.stats', 'api.profile',
  'api.role', 'api.checks', 'api.order', 'api.payment-update',
  'api.invoice', 'api.webhook', 'api.unhandled', 'qualification'
]);
let active = false;
export function safeEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent {
  if (hint) hint.attachments = [];
  const candidate = event.tags?.boundary;
  const boundary = typeof candidate === 'string' && BOUNDARIES.has(candidate) ? candidate : 'unhandled';
  return {
    event_id: /^[a-f0-9]{32}$/.test(event.event_id || '') ? event.event_id : undefined,
    timestamp: Date.now() / 1000,
    type: undefined,
    level: event.level === 'fatal' ? 'fatal' : 'error',
    message: 'NahThatsFake application error',
    tags: { app: 'nahthatsfake', runtime: 'bot', boundary },
    fingerprint: ['nahthatsfake', boundary],
  };
}
export function initReporting(options: { enabled?: boolean; transport?: NodeOptions['transport'] } = {}) {
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
export async function reportError(boundary: string) {
  if (!active || !BOUNDARIES.has(boundary)) return;
  try {
    Sentry.captureEvent({ level: 'error', message: 'NahThatsFake application error', tags: { boundary } });
    // SDK timeout arguments are not a wall-clock deadline for arbitrary work.
    let timer: ReturnType<typeof setTimeout> | undefined;
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
export const flush = (timeout: number) => Sentry.flush(timeout);
initReporting();
