import * as Sentry from "@sentry/node";

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-dashboard-token',
  'x-telegram-bot-api-secret-token',
  'x-hub-signature-256'
]);

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      headers[key] = '[REDACTED]';
    }
  }
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const sampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1);

  Sentry.init({
    dsn,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false
    },
    tracesSampleRate: Number.isFinite(sampleRate) ? Math.min(Math.max(sampleRate, 0), 1) : 0.1,
    beforeSend(event) {
      scrubHeaders(event.request?.headers);
      if (event.request?.data) {
        event.request.data = '[REDACTED]';
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb?.data && typeof breadcrumb.data === 'object') {
        for (const key of Object.keys(breadcrumb.data)) {
          if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
            breadcrumb.data[key] = '[REDACTED]';
          }
        }
      }
      return breadcrumb;
    }
  });
}

export function captureException(err, context = {}) {
  try {
    Sentry.captureException(err, { extra: context });
  } catch (e) {
    console.error("Sentry Capture Error:", e);
  }
}
