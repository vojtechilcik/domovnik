/**
 * Sentry error tracking configuration.
 * Set SENTRY_DSN environment variable in production to enable.
 * Works server-side (NestJS) and optionally client-side (React/Expo).
 */

export function getSentryConfig() {
  const dsn = process.env['SENTRY_DSN'];

  return {
    dsn: dsn ?? '',
    enabled: !!dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: 'domovnik@0.0.1',
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    // Filter out health check requests to avoid noise
    beforeSend(event: any) {
      if (event.request?.url?.includes('/health')) return null;
      return event;
    },
  };
}