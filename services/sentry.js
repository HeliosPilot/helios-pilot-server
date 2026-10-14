import * as Sentry from "@sentry/node";

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn: dsn,
    tracesSampleRate: 1.0,
  });
}

export function captureException(err, context = {}) {
  try {
    Sentry.captureException(err, { extra: context });
  } catch (e) {
    console.error("Sentry Capture Error:", e);
  }
}
