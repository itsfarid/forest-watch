/**
 * Environment variable validation
 * Call this at module load time in services that require env vars.
 * Next.js App Router does not have a universal startup hook, so validation
 * is triggered when the relevant service module is first imported -- which
 * happens on the first request that needs it, but the error will be clear
 * and immediate rather than buried in a downstream API failure.
 */

/**
 * Validate all required environment variables.
 * Reports ALL missing variables at once so developers don't have to
 * fix one, restart, and discover the next missing variable.
 *
 * @throws Error listing every missing required variable
 */
export function validateEnv(): void {
  const required: Record<string, string> = {
    OPENAI_API_KEY: 'OpenAI API key for chat completion',
    ROBOFLOW_API_KEY: 'Roboflow API key for inference',
  };

  // At least one Roboflow target must be configured
  const roboflowTargets = [
    process.env.ROBOFLOW_MODEL_ID,
    process.env.ROBOFLOW_INFERENCE_URL,
    process.env.ROBOFLOW_DETECT_MODEL,
  ].filter(Boolean);

  const missing: string[] = [];

  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      missing.push(`  - ${key}: ${description}`);
    }
  }

  if (roboflowTargets.length === 0) {
    missing.push(
      '  - ROBOFLOW_MODEL_ID / ROBOFLOW_INFERENCE_URL / ROBOFLOW_DETECT_MODEL: ' +
      'at least one Roboflow inference target must be set'
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.join('\n')}\n\n` +
      'Copy .env.example to .env.local and fill in the values.'
    );
  }
}

/**
 * Validate env vars required specifically for Roboflow
 */
export function validateRoboflowEnv(): void {
  validateEnv();
}

/**
 * Validate env vars required specifically for OpenAI
 */
export function validateOpenAIEnv(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'Missing required environment variable: OPENAI_API_KEY\n' +
      'Copy .env.example to .env.local and fill in the values.'
    );
  }
}
