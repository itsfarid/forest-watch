/**
 * Canvas Drawing Utilities
 * Functions for drawing bounding boxes and visualizations on canvas
 */

import { RoboflowPrediction } from '@/lib/types/roboflow.types';

/**
 * Result of validating a single prediction
 */
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a single prediction before drawing.
 * Roboflow returns x,y as the CENTER of the bounding box, confidence as 0-1.
 *
 * @param prediction - The prediction to validate
 * @param imageWidth - Canvas/image width in pixels
 * @param imageHeight - Canvas/image height in pixels
 */
export function validatePrediction(
  prediction: RoboflowPrediction,
  imageWidth: number,
  imageHeight: number
): ValidationResult {
  const { x, y, width, height, confidence, class: className } = prediction;

  // 1. Required numeric fields must exist and be finite numbers
  for (const [field, value] of Object.entries({ x, y, width, height, confidence })) {
    if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
      return { valid: false, reason: `Field "${field}" is missing, null, or not a finite number (got ${value})` };
    }
  }

  // 2. Dimensions must be positive
  if (width <= 0) return { valid: false, reason: `width must be > 0 (got ${width})` };
  if (height <= 0) return { valid: false, reason: `height must be > 0 (got ${height})` };

  // 3. Confidence must be in [0, 1]
  if (confidence < 0 || confidence > 1) {
    return { valid: false, reason: `confidence must be in [0, 1] (got ${confidence})` };
  }

  // 4. Box must not extend outside image bounds (x,y are CENTER coordinates)
  const boxLeft = x - width / 2;
  const boxTop = y - height / 2;
  const boxRight = x + width / 2;
  const boxBottom = y + height / 2;

  if (boxLeft < 0) return { valid: false, reason: `box left edge out of bounds (${boxLeft.toFixed(1)} < 0)` };
  if (boxTop < 0) return { valid: false, reason: `box top edge out of bounds (${boxTop.toFixed(1)} < 0)` };
  if (boxRight > imageWidth) return { valid: false, reason: `box right edge out of bounds (${boxRight.toFixed(1)} > ${imageWidth})` };
  if (boxBottom > imageHeight) return { valid: false, reason: `box bottom edge out of bounds (${boxBottom.toFixed(1)} > ${imageHeight})` };

  // 5. Class label must be a non-empty string
  if (typeof className !== 'string' || className.trim() === '') {
    return { valid: false, reason: `class label is missing or empty (got ${JSON.stringify(className)})` };
  }

  return { valid: true };
}

/**
 * Draw bounding boxes on a canvas element
 * @param canvasId - ID of the canvas element
 * @param imageDataUri - Base64 data URI of the image
 * @param predictions - Array of predictions with bounding box coordinates
 */
export function drawBoxesOnCanvas(
  canvasId: string,
  imageDataUri: string,
  predictions: RoboflowPrediction[]
): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get 2D context from canvas');
    return;
  }

  const img = new Image();

  img.onload = () => {
    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the image
    ctx.drawImage(img, 0, 0);

    // Validate predictions before drawing -- skip invalid ones, never crash
    let validCount = 0;
    let skippedCount = 0;

    predictions.forEach((pred, idx) => {
      const result = validatePrediction(pred, img.width, img.height);

      if (!result.valid) {
        console.warn(
          `[drawBoxesOnCanvas] Skipping prediction #${idx} -- ${result.reason}`,
          pred
        );
        skippedCount++;
        return;
      }

      drawSingleBox(ctx, pred);
      validCount++;
    });

    // Distinguish between "no predictions at all" vs "all predictions were invalid"
    if (predictions.length > 0 && validCount === 0) {
      console.warn(
        `[drawBoxesOnCanvas] All ${skippedCount} prediction(s) failed validation -- ` +
        'this may indicate an unexpected API response format. No boxes drawn. ' +
        'This is NOT the same as "no deforestation detected".'
      );
    } else if (skippedCount > 0) {
      console.warn(
        `[drawBoxesOnCanvas] Drew ${validCount} valid box(es), skipped ${skippedCount} invalid prediction(s).`
      );
    }
  };

  img.onerror = (error) => {
    console.error('Failed to load image for canvas drawing:', error);
  };

  img.src = imageDataUri;
}

/**
 * Draw a single bounding box with label
 */
function drawSingleBox(
  ctx: CanvasRenderingContext2D,
  prediction: RoboflowPrediction
): void {
  const { x, y, width, height, confidence, class: className } = prediction;

  // Calculate box coordinates (Roboflow uses center x,y)
  const boxX = x - width / 2;
  const boxY = y - height / 2;

  // Determine color based on confidence
  const color = getBoxColor(confidence);

  // Draw bounding box
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, width, height);

  // Draw semi-transparent fill
  ctx.fillStyle = `${color}33`; // 20% opacity
  ctx.fillRect(boxX, boxY, width, height);

  // Draw label background
  const label = `${className} ${(confidence * 100).toFixed(1)}%`;
  ctx.font = 'bold 16px Arial';
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;
  const textHeight = 20;
  const padding = 4;

  ctx.fillStyle = color;
  ctx.fillRect(
    boxX,
    boxY - textHeight - padding,
    textWidth + padding * 2,
    textHeight + padding
  );

  // Draw label text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, boxX + padding, boxY - padding);
}

/**
 * Get color based on confidence level
 */
function getBoxColor(confidence: number): string {
  if (confidence >= 0.9) return '#00FF00'; // Green for high confidence
  if (confidence >= 0.7) return '#FFA500'; // Orange for medium confidence
  return '#FF0000'; // Red for low confidence
}

/**
 * Clear canvas
 */
export function clearCanvas(canvasId: string): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found`);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Download canvas as image
 */
export function downloadCanvasAsImage(
  canvasId: string,
  filename: string = 'detection-result.png'
): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found`);
    return;
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      console.error('Failed to create blob from canvas');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  });
}
