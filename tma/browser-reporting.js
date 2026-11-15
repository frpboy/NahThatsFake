import { init, globalHandlersIntegration } from '@sentry/browser';
// Fixed schema: never forward the raw exception, page URL, Telegram context,
// form values, DOM text, user, breadcrumb, stack, file path or attachment.
export function safeBrowserEvent(event, hint) {
  if (hint) hint.attachments = [];
  return {
    event_id: /^[a-f0-9]{32}$/.test(event.event_id || '') ? event.event_id : undefined,
    timestamp: Date.now() / 1000,
    type: undefined,
    level: 'error',
    message: 'NahThatsFake application error',
    tags: { app: 'nahthatsfake', runtime: 'browser', boundary: 'web.unhandled' },
    fingerprint: ['nahthatsfake', 'web.unhandled'],
  };
}
export function initBrowserReporting(options = {}) {
  try {
    init({
      dsn: 'https://c5b3504a11565ca803b515b6555c3379@o4510460282601472.ingest.us.sentry.io/4512436387053568',
      defaultIntegrations: false,
      integrations: [globalHandlersIntegration()],
      sendDefaultPii: false,
      attachStacktrace: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      enableLogs: false,
      sendClientReports: false,
      beforeSend: safeBrowserEvent,
      beforeSendTransaction: () => null,
      ...options.transport && { transport: options.transport },
    });
  } catch (_) {
    // Diagnostics must not break the Mini App.
  }
}
// Only the explicit production bundle enables reporting; source/dev is inert.
if (typeof __REPORTING_PRODUCTION__ !== 'undefined' && __REPORTING_PRODUCTION__ && typeof window !== 'undefined') initBrowserReporting();
