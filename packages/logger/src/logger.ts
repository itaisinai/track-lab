export type LogDetails = Record<string, unknown>;

export type TrackLabLogger = (
  message: string,
  details?: LogDetails,
) => void;

export function logEvent(
  scope: string,
  message: string,
  details: LogDetails = {},
) {
  console.info(`[${scope}] ${message}`, details);
}

export function createScopedLogger(scope: string): TrackLabLogger {
  return (message, details) => {
    logEvent(scope, message, details);
  };
}

export function logProviderSearch(
  provider: string,
  message: string,
  details: LogDetails = {},
) {
  logEvent(`provider:${provider}`, message, details);
}

export function logRemixSearch(message: string, details?: LogDetails) {
  logEvent("remix-search", message, details);
}

export function logRemixProvider(
  provider: string,
  message: string,
  details: LogDetails = {},
) {
  logEvent(`remix-search:${provider}`, message, details);
}
