/**
 * Structured logging service for Forest Watch AI.
 * Outputs structured JSON-like logs in production, readable logs in development.
 * Interface is designed to be easily extended with Sentry or other monitoring
 * services in the future without changing call sites.
 */

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== "production";

function formatMessage(
  level: LogLevel,
  message: string,
  context?: LogContext,
): string {
  const timestamp = new Date().toISOString();
  if (isDev) {
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }
  return JSON.stringify({ timestamp, level, message, ...context });
}

export const logger = {
  error(message: string, context?: LogContext): void {
    console.error(formatMessage("error", message, context));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage("warn", message, context));
  },
  info(message: string, context?: LogContext): void {
    console.info(formatMessage("info", message, context));
  },
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(formatMessage("debug", message, context));
    }
  },
};
