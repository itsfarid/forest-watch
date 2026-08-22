/**
 * Roboflow API types
 */

export interface RoboflowPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
  detection_id?: string;
}

export interface RoboflowInferenceResponse {
  predictions?: RoboflowPrediction[];
  outputs?: Array<{ predictions?: RoboflowPrediction[] }>;
  results?: Array<{ predictions?: RoboflowPrediction[] }>;
  data?: { predictions?: RoboflowPrediction[] };
  image?: {
    width: number;
    height: number;
  };
  visualization?: string;
  inferenceTime?: number;
  time?: number;
}

export interface RoboflowCallResult {
  success: boolean;
  predictions: RoboflowPrediction[];
  visualization?: string;
  debugInfo?: string;
  error?: string;
}

export interface RoboflowConfig {
  apiKey: string;
  modelId?: string;
  inferenceUrl?: string;
  detectModel?: string;
  debug?: boolean;
  confidenceThreshold?: number;
  overlapThreshold?: number;
}
