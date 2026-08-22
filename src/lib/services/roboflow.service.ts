/**
 * Roboflow API Service
 * Handles all communication with Roboflow inference endpoints
 */

import {
  RoboflowPrediction,
  RoboflowInferenceResponse,
  RoboflowCallResult,
  RoboflowConfig,
} from '@/lib/types/roboflow.types';
import { sleep, calculateBackoff } from '@/lib/utils';
import { ROBOFLOW_DEFAULTS } from '@/lib/config/constants';

/**
 * Get Roboflow configuration from environment variables
 */
export function getRoboflowConfig(): RoboflowConfig {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const modelId = process.env.ROBOFLOW_MODEL_ID;
  const inferenceUrl = process.env.ROBOFLOW_INFERENCE_URL;
  const detectModel = process.env.ROBOFLOW_DETECT_MODEL || modelId;
  const debug = process.env.ROBOFLOW_DEBUG === 'true';
  const confidenceThreshold =
    parseFloat(process.env.ROBOFLOW_CONFIDENCE_THRESHOLD ?? '') ||
    ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD;
  const overlapThreshold =
    parseFloat(process.env.ROBOFLOW_OVERLAP_THRESHOLD ?? '') ||
    ROBOFLOW_DEFAULTS.OVERLAP_THRESHOLD;

  if (!apiKey) {
    throw new Error('ROBOFLOW_API_KEY is not configured');
  }

  if (!modelId && !inferenceUrl && !detectModel) {
    throw new Error(
      'At least one of ROBOFLOW_MODEL_ID, ROBOFLOW_INFERENCE_URL, or ROBOFLOW_DETECT_MODEL must be configured'
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
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * Extract predictions from various Roboflow response formats
 * Roboflow responses can have predictions nested in different locations depending on the endpoint
 */
export function extractPredictionsFromResponse(
  rfResponse: RoboflowInferenceResponse
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
  const findPreds = (obj: Record<string, unknown>): RoboflowPrediction[] | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj.predictions)) return obj.predictions;

    for (const val of Object.values(obj)) {
      if (val && typeof val === 'object') {
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
  imageDataUri: string
): Promise<RoboflowCallResult> {
  const config = getRoboflowConfig();

  // Try with retry logic
  for (let attempt = 0; attempt < ROBOFLOW_DEFAULTS.MAX_RETRIES; attempt++) {
    try {
      const result = await callRoboflowInferenceAPIOnce(imageDataUri, config);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === ROBOFLOW_DEFAULTS.MAX_RETRIES - 1;

      if (isLastAttempt) {
        console.error('Roboflow API call failed after all retries:', error);
        return {
          success: false,
          predictions: [],
          error:
            error instanceof Error
              ? error.message
              : 'Failed to call Roboflow API after multiple attempts',
        };
      }

      // Exponential backoff
      const delayMs = calculateBackoff(
        attempt,
        ROBOFLOW_DEFAULTS.INITIAL_RETRY_DELAY_MS
      );
      console.warn(
        `Roboflow API call attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
        error
      );
      await sleep(delayMs);
    }
  }

  // Should never reach here due to the return in the last attempt
  return {
    success: false,
    predictions: [],
    error: 'Unexpected error in retry logic',
  };
}

/**
 * Single attempt to call Roboflow API (with timeout)
 */
async function callRoboflowInferenceAPIOnce(
  imageDataUri: string,
  config: RoboflowConfig
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
        controller.signal
      );
      if (result.success) return result;
    }

    // 2) Try JSON API endpoint if model ID is available
    if (config.modelId) {
      const result = await tryJsonApiEndpoint(
        imageDataUri,
        config,
        controller.signal
      );
      if (result.success) return result;
    }

    // 3) Fallback to detect.roboflow.com with multipart/form-data
    if (config.detectModel) {
      const result = await tryDetectEndpoint(
        imageDataUri,
        config,
        controller.signal
      );
      if (result.success) return result;
    }

    return {
      success: false,
      predictions: [],
      error: 'All Roboflow endpoints failed',
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
  signal: AbortSignal
): Promise<RoboflowCallResult> {
  try {
    const url = config.inferenceUrl!;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUri }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Custom inference URL failed: ${res.status} ${res.statusText}`);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    console.warn('Custom inference URL attempt failed:', error);
    return {
      success: false,
      predictions: [],
      error: error instanceof Error ? error.message : 'Custom inference URL failed',
    };
  }
}

/**
 * Try JSON API endpoint (api.roboflow.com)
 */
async function tryJsonApiEndpoint(
  imageDataUri: string,
  config: RoboflowConfig,
  signal: AbortSignal
): Promise<RoboflowCallResult> {
  try {
    const safePath = safeModelPathEncode(config.modelId!);
    const params = new URLSearchParams({
      api_key: config.apiKey,
    });

    if (config.confidenceThreshold !== undefined) {
      params.set('confidence', config.confidenceThreshold.toString());
    }
    if (config.overlapThreshold !== undefined) {
      params.set('overlap', config.overlapThreshold.toString());
    }

    const url = `https://api.roboflow.com/${safePath}/infer?${params.toString()}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUri }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`JSON API endpoint failed: ${res.status} ${res.statusText}`);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    console.warn('JSON API endpoint attempt failed:', error);
    return {
      success: false,
      predictions: [],
      error: error instanceof Error ? error.message : 'JSON API endpoint failed',
    };
  }
}

/**
 * Try detect endpoint with multipart/form-data (detect.roboflow.com)
 */
async function tryDetectEndpoint(
  imageDataUri: string,
  config: RoboflowConfig,
  signal: AbortSignal
): Promise<RoboflowCallResult> {
  try {
    const safePath = safeModelPathEncode(config.detectModel!);
    const params = new URLSearchParams({
      api_key: config.apiKey,
    });

    if (config.confidenceThreshold !== undefined) {
      params.set('confidence', config.confidenceThreshold.toString());
    }
    if (config.overlapThreshold !== undefined) {
      params.set('overlap', config.overlapThreshold.toString());
    }

    const url = `https://detect.roboflow.com/${safePath}?${params.toString()}`;

    // Convert data URI to blob
    const base64Data = imageDataUri.split(',')[1] || imageDataUri;
    const mimeMatch = imageDataUri.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const byteString = Buffer.from(base64Data, 'base64');
    const blob = new Blob([byteString], { type: mimeType });

    const formData = new FormData();
    formData.append('file', blob, 'image.jpg');

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      signal,
    });

    if (!res.ok) {
      throw new Error(`Detect endpoint failed: ${res.status} ${res.statusText}`);
    }

    const data: RoboflowInferenceResponse = await res.json();
    const predictions = extractPredictionsFromResponse(data);

    // Debug mode: return visualization if no predictions
    if (predictions.length === 0 && config.debug && data.visualization) {
      return {
        success: true,
        predictions: [],
        visualization: data.visualization,
        debugInfo: 'No predictions found, returning visualization for debugging',
      };
    }

    return {
      success: true,
      predictions,
      visualization: data.visualization,
    };
  } catch (error) {
    console.warn('Detect endpoint attempt failed:', error);
    return {
      success: false,
      predictions: [],
      error: error instanceof Error ? error.message : 'Detect endpoint failed',
    };
  }
}
