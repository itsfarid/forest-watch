/**
 * Application constants and configuration
 */

export const ROBOFLOW_DEFAULTS = {
  CONFIDENCE_THRESHOLD: 0.5,
  OVERLAP_THRESHOLD: 0.5,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
  INITIAL_RETRY_DELAY_MS: 1000,
} as const;

export const OPENAI_DEFAULTS = {
  MODEL: 'gpt-3.5-turbo',
  TEMPERATURE: 0.3,
} as const;
