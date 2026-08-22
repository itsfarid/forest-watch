/**
 * Server-side text input sanitization and validation.
 * Applied before passing user text to OpenAI.
 */

const MAX_TEXT_LENGTH = 1000;

/**
 * Sanitize and validate a text message from the user.
 * - Trims whitespace
 * - Strips HTML tags to prevent injection in any downstream rendering context
 * - Enforces max length (truncates with a notice rather than hard-rejecting,
 *   so user experience is not broken for slightly-over inputs)
 *
 * Returns the sanitized string, or throws if input is fundamentally invalid.
 */
export function sanitizeTextInput(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string.');
  }

  // Trim whitespace
  let sanitized = text.trim();

  // Strip HTML/script tags -- prevents injection if output is ever rendered as HTML
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Collapse multiple whitespace into single spaces after stripping tags
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate if over max length (prefer truncate over reject for UX)
  if (sanitized.length > MAX_TEXT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_TEXT_LENGTH);
  }

  return sanitized;
}

/**
 * Check if a sanitized text input is usable (non-empty after sanitization)
 */
export function isValidTextInput(text: string): boolean {
  return sanitizeTextInput(text).length > 0;
}
