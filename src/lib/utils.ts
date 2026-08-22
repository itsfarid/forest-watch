import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind CSS class name merger utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds
 */
export function calculateBackoff(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Determine if an error is worth retrying.
 * Retryable: network errors, timeouts, HTTP 429, HTTP 5xx.
 * Non-retryable: HTTP 400, 401, 403, 404 — retrying won't help.
 * @param error - The error thrown by a fetch attempt
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  // AbortController timeout — retryable
  if (error.name === 'AbortError') return true;

  // Network-level errors (no HTTP status) — retryable
  const message = error.message.toLowerCase();
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout')
  ) {
    return true;
  }

  // Extract HTTP status from error messages like "HTTP 429" or "status 503"
  const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    // 429 Too Many Requests and 5xx Server Errors — retryable
    if (status === 429 || status >= 500) return true;
    // All other 4xx (400, 401, 403, 404, etc.) — not retryable
    if (status >= 400 && status < 500) return false;
  }

  // Unknown error — retry by default
  return true;
}
