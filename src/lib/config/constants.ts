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

/**
 * Image compression settings for client-side pre-processing before sending to Roboflow.
 * 1024px and quality 0.85 are chosen to preserve satellite/aerial imagery detail
 * needed for deforestation detection, while keeping payload size reasonable for API calls.
 * Images smaller than the max dimensions are NOT upscaled.
 */
export const IMAGE_COMPRESSION = {
  MAX_WIDTH: 1024,
  MAX_HEIGHT: 1024,
  QUALITY: 0.85,
  /** Client-side submit timeout in ms (55s -- just under Vercel's 60s function limit) */
  SUBMIT_TIMEOUT_MS: 55000,
} as const;
