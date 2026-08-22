/**
 * Canvas Drawing Utilities
 * Functions for drawing bounding boxes and visualizations on canvas
 */

import { RoboflowPrediction } from '@/lib/types/roboflow.types';

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

    // Draw each prediction box
    predictions.forEach((pred) => {
      drawSingleBox(ctx, pred);
    });
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
