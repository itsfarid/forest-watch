/**
 * Roboflow API Service
 * Handles all communication with Roboflow inference endpoints
 */

import {
  RoboflowPrediction,
  RoboflowInferenceResponse,
  RoboflowCallResult,
  RoboflowConfig,
} from "@/lib/types/roboflow.types";
import { sleep, calculateBackoff, isRetryableError } from "@/lib/utils";
import { ROBOFLOW_DEFAULTS } from "@/lib/config/constants";
import {
  roboflowErrorFromStatus,
  roboflowErrorFromException,
  RoboflowError,
} from "@/lib/errors/api-errors";
import { validateEnv } from "@/lib/config/env";
import { logger } from "@/lib/logger";

// Validate required env vars at module load time
validateEnv();

/**
 * Get Roboflow configuration from environment variables
 */
export function getRoboflowConfig(): RoboflowConfig {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const modelId = process.env.ROBOFLOW_MODEL_ID;
  const inferenceUrl = process.env.ROBOFLOW_INFERENCE_URL;
  const detectModel = process.env.ROBOFLOW_DETECT_MODEL || modelId;
  const debug = process.env.ROBOFLOW_DEBUG === "true";
  const confidenceThreshold =
    parseFloat(process.env.ROBOFLOW_CONFIDENCE_THRESHOLD ?? "") ||
    ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD;
  const overlapThreshold =
    parseFloat(process.env.ROBOFLOW_OVERLAP_THRESHOLD ?? "") ||
    ROBOFLOW_DEFAULTS.OVERLAP_THRESHOLD;

  if (!apiKey) {
    throw new Error("ROBOFLOW_API_KEY is not configured");
  }

  if (!modelId && !inferenceUrl && !detectModel) {
    throw new Error(
      "At least one of ROBOFLOW_MODEL_ID, ROBOFLOW_INFERENCE_URL, or ROBOFLOW_DETECT_MODEL must be configured",
    );
  }

  return {
    apiKey,
    modelId,
    inferenceUrl,
    detectModel,
    debug,
    confidenceThreshold,
    overlapThreshold,
  };
}

/**
 * Check if Roboflow is properly configured
 */
export function isRoboflowConfigured(): boolean {
  try {
    getRoboflowConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode each segment of a path but preserve slashes
 * Example: 'owner/project-name/version' -> 'owner/project-name/version' (with encoded segments)
 */
export function safeModelPathEncode(id: string): string {
  return id
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/**
 * Extract predictions from various Roboflow response formats.
 *
 * Roboflow returns different response shapes depending on deployment type:
 * - Hosted Inference API: predictions at response.predictions (direct array)
 * - Workflows / Serverless: predictions at response.outputs[0].predictions
 * - Batch / Dedicated: predictions at response.results[0].predictions
 * - Data-wrapped responses: predictions at response.data.predictions
 * - Unknown/custom: recursive depth-first search for any "predictions" array
 *
 * Checks are performed in order of most common to least common.
 * Falls back to empty array if no predictions are found in any known path.
 *
 * @param rfResponse - Raw response object from Roboflow Inference API
 * @returns Array of RoboflowPrediction, or empty array if none found
 */
export function extractPredictionsFromResponse(
  rfResponse: RoboflowInferenceResponse,
): RoboflowPrediction[] {
  if (!rfResponse) return [];

  // Direct predictions
  if (Array.isArray(rfResponse.predictions)) return rfResponse.predictions;

  // Workflow/serverless format: outputs[0].predictions
  if (Array.isArray(rfResponse.outputs?.[0]?.predictions)) {
    return rfResponse.outputs[0].predictions;
  }

  // Alternative format: results[0].predictions
  if (Array.isArray(rfResponse.results?.[0]?.predictions)) {
    return rfResponse.results[0].predictions;
  }

  // Data wrapper: data.predictions
  if (Array.isArray(rfResponse.data?.predictions)) {
    return rfResponse.data.predictions;
  }

  // Recursive search for predictions in nested objects
  const findPreds = (
    obj: Record<string, unknown>,
  ): RoboflowPrediction[] | null => {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj.predictions)) return obj.predictions;

    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") {
        const found = findPreds(val as Record<string, unknown>);
        if (found) return found;
      }
    }
    return null;
  };

  const found = findPreds(rfResponse as unknown as Record<string, unknown>);
  return found || [];
}

/**
 * Call Roboflow inference API with retry logic and timeout
 * Attempts multiple endpoints in order:
 * 1) Custom ROBOFLOW_INFERENCE_URL (if provided)
 * 2) API JSON endpoint (api.roboflow.com)
 * 3) Detect endpoint fallback (detect.roboflow.com with multipart/form-data)
 */
export async function callRoboflowInferenceAPI(
  imageDataUri: string,
  confidenceThreshold?: number,
): Promise<RoboflowCallResult> {
  const config = getRoboflowConfig();

  // Override confidence threshold from client if provided
  const effectiveConfig =
    confidenceThreshold !== undefined
      ? { ...config, confidenceThreshold }
      : config;

  // Try with retry logic
  for (let attempt = 0; attempt < ROBOFLOW_DEFAULTS.MAX_RETRIES; attempt++) {
    try {
      const result = await callRoboflowInferenceAPIOnce(
        imageDataUri,
        effectiveConfig,
      );
      return result;
    } catch (error) {
      const isLastAttempt = attempt === ROBOFLOW_DEFAULTS.MAX_RETRIES - 1;

      // Non-retryable errors (400, 401, 403, 404, etc.) — bail out immediately
      if (!isRetryableError(error)) {
        const appErr =
          error instanceof RoboflowError
            ? error
            : roboflowErrorFromException(error);
        logger.error("Roboflow API call failed with non-retryable error", {
          technical: appErr.technicalMessage,
        });
        return {
          success: false,
          predictions: [],
          error: appErr.userMessage,
        };
      }

      if (isLastAttempt) {
        const appErr =
          error instanceof RoboflowError
            ? error
            : roboflowErrorFromException(error);
        logger.error("Roboflow API call failed after all retries", {
          technical: appErr.technicalMessage,
        });
        return {
          success: false,
          predictions: [],
          error: appErr.userMessage,
        };
      }

      // Exponential backoff
      const delayMs = calculateBackoff(
        attempt,
        ROBOFLOW_DEFAULTS.INITIAL_RETRY_DELAY_MS,
      );
      const errMsg =
        error instanceof RoboflowError
          ? error.technicalMessage
          : error instanceof Error
            ? error.message
            : String(error);
      logger.warn(
        `Roboflow API call attempt ${attempt + 1} failed, retrying in ${delayMs}ms... (${errMsg})`,
      );
      await sleep(delayMs);
    }
  }

  // Should never reach here due to the return in the last attempt
  return {
    success: false,
    predictions: [],
    error: "Unexpected error in retry logic",
  };
}

/**
 * Single attempt to call Roboflow API (with timeout)
 */
async function callRoboflowInferenceAPIOnce(
  imageDataUri: string,
  config: RoboflowConfig,
): Promise<RoboflowCallResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ROBOFLOW_DEFAULTS.TIMEOUT_MS);

  try {
    // 1) Try custom inference URL if provided
    if (config.inferenceUrl) {
      const result = await tryCustomInferenceUrl(
        imageDataUri,
        config,
        controller.signal,
      );
      if (result.success) return result;
    }

    // 2) Try JSON API endpoint if model ID is available
    if (config.modelId) {
      const result = await tryJsonApiEndpoint(
        imageDataUri,
        config,
        controller.signal,
      );
      if (result.success) return result;
    }

    // 3) Fallback to detect.roboflow.com with multipart/form-data
    if (config.detectModel) {
      const result = await tryDetectEndpoint(
        imageDataUri,
        config,
        controller.signal,
      );
      if (result.success) return result;
    }

    return {
      success: false,
      predictions: [],
      error: "All Roboflow endpoints failed",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Try custom inference URL
 */
async function tryCustomInferenceUrl(
  imageDataUri: string,
  config: RoboflowConfig,
  signal: AbortSignal,
): Promise<RoboflowCallResult> {
  try {
    const url = config.inferenceUrl!;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUri }),
      signal,
    });

    if (!res.ok) {
      throw roboflowErrorFromStatus(res.status, res.statusText);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    if (error instanceof RoboflowError) throw error;
    logger.warn("Custom inference URL attempt failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw roboflowErrorFromException(error);
  }
}

/**
 * Try JSON API endpoint (api.roboflow.com)
 */
async function tryJsonApiEndpoint(
  imageDataUri: string,
  config: RoboflowConfig,
  signal: AbortSignal,
): Promise<RoboflowCallResult> {
  try {
    const safePath = safeModelPathEncode(config.modelId!);
    const params = new URLSearchParams({
      api_key: config.apiKey,
    });

    if (config.confidenceThreshold !== undefined) {
      params.set("confidence", config.confidenceThreshold.toString());
    }
    if (config.overlapThreshold !== undefined) {
      params.set("overlap", config.overlapThreshold.toString());
    }

    const url = `https://api.roboflow.com/${safePath}/infer?${params.toString()}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUri }),
      signal,
    });

    if (!res.ok) {
      throw roboflowErrorFromStatus(res.status, res.statusText);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    if (error instanceof RoboflowError) throw error;
    logger.warn("JSON API endpoint attempt failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw roboflowErrorFromException(error);
  }
}

/**
 * Try detect endpoint with multipart/form-data (detect.roboflow.com)
 */
async function tryDetectEndpoint(
  imageDataUri: string,
  config: RoboflowConfig,
  signal: AbortSignal,
): Promise<RoboflowCallResult> {
  try {
    const safePath = safeModelPathEncode(config.detectModel!);
    const params = new URLSearchParams({
      api_key: config.apiKey,
    });

    if (config.confidenceThreshold !== undefined) {
      params.set("confidence", config.confidenceThreshold.toString());
    }
    if (config.overlapThreshold !== undefined) {
      params.set("overlap", config.overlapThreshold.toString());
    }

    const url = `https://detect.roboflow.com/${safePath}?${params.toString()}`;

    // Convert data URI to blob
    const base64Data = imageDataUri.split(",")[1] || imageDataUri;
    const mimeMatch = imageDataUri.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    const byteString = Buffer.from(base64Data, "base64");
    const blob = new Blob([byteString], { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, "image.jpg");

    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal,
    });

    if (!res.ok) {
      throw roboflowErrorFromStatus(res.status, res.statusText);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    // Debug mode: return visualization if no predictions
    if (predictions.length === 0 && config.debug && data.visualization) {
      return {
        success: true,
        predictions: [],
        visualization: data.visualization,
        debugInfo:
          "No predictions found, returning visualization for debugging",
      };
    }

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    if (error instanceof RoboflowError) throw error;
    logger.warn("Detect endpoint attempt failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw roboflowErrorFromException(error);
  }
}
