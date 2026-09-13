"use client";

import { RoboflowPrediction } from "@/lib/types/roboflow.types";
import { validatePrediction } from "@/lib/canvas/drawBoxes";

interface BoundingBoxOverlayProps {
  imageUrl: string;
  predictions: RoboflowPrediction[];
  alt?: string;
}

/**
 * Renders an image with SVG bounding box overlays for Roboflow predictions.
 * Uses SVG elements instead of canvas to avoid base64 re-encoding and main thread blocking.
 * Box positions are computed as percentages so they scale correctly with the image.
 */
export function BoundingBoxOverlay({
  imageUrl,
  predictions,
  alt = "Analyzed image",
}: BoundingBoxOverlayProps) {
  return (
    <div className="relative inline-block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="w-full h-auto block rounded-md"
      />
      {predictions.length > 0 && (
        <ImageWithOverlay imageUrl={imageUrl} predictions={predictions} />
      )}
    </div>
  );
}

/**
 * Inner component that loads the image to get natural dimensions,
 * then renders the SVG overlay with accurate percentage-based positioning.
 */
function ImageWithOverlay({
  imageUrl,
  predictions,
}: {
  imageUrl: string;
  predictions: RoboflowPrediction[];
}) {
  // Use an onLoad callback via a hidden img to get natural dimensions
  // We render the SVG absolutely over the visible img above
  return <NaturalSizeOverlay imageUrl={imageUrl} predictions={predictions} />;
}

/**
 * Loads the image naturally to determine width/height,
 * then renders the SVG overlay using percentage coordinates.
 */
function NaturalSizeOverlay({
  imageUrl,
  predictions,
}: {
  imageUrl: string;
  predictions: RoboflowPrediction[];
}) {
  // We use a temporary Image object client-side to get natural dimensions.
  // This runs synchronously from a ref callback in the visible <img> onLoad.
  // Since this is a client component and imageUrl is already loaded above,
  // we can read naturalWidth/Height from the already-rendered img element.
  // We pass dimensions via state after the visible img loads.
  const [dimensions, setDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);

  return (
    <>
      {/* Hidden img to detect natural dimensions */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="hidden"
        onLoad={(e) => {
          const img = e.currentTarget;
          setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        }}
      />
      {dimensions && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
          aria-label="Detection overlay"
        >
          {predictions.map((pred, idx) => {
            const result = validatePrediction(
              pred,
              dimensions.width,
              dimensions.height,
            );
            if (!result.valid) return null;

            // Roboflow uses center x,y
            const boxX = pred.x - pred.width / 2;
            const boxY = pred.y - pred.height / 2;
            const color = getBoxColor(pred.confidence);
            // Sanitize class label — strip any characters that could break SVG rendering
            const safeLabel = `${pred.class.replace(/[<>&"']/g, "").slice(0, 50)} ${(pred.confidence * 100).toFixed(1)}%`;

            return (
              <g key={`${idx}-${pred.class}-${pred.x}-${pred.y}`}>
                {/* Box fill */}
                <rect
                  x={boxX}
                  y={boxY}
                  width={pred.width}
                  height={pred.height}
                  fill={color}
                  fillOpacity={0.15}
                  stroke={color}
                  strokeWidth={Math.max(dimensions.width * 0.003, 1.5)}
                />
                {/* Label background */}
                <rect
                  x={boxX}
                  y={Math.max(boxY - dimensions.height * 0.035, 0)}
                  width={safeLabel.length * dimensions.width * 0.012}
                  height={dimensions.height * 0.035}
                  fill={color}
                  fillOpacity={0.85}
                  rx={2}
                />
                {/* Label text */}
                <text
                  x={boxX + dimensions.width * 0.005}
                  y={Math.max(
                    boxY - dimensions.height * 0.008,
                    dimensions.height * 0.025,
                  )}
                  fill="white"
                  fontSize={dimensions.height * 0.028}
                  fontWeight="bold"
                  fontFamily="Arial, sans-serif"
                >
                  {safeLabel}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </>
  );
}

function getBoxColor(confidence: number): string {
  if (confidence >= 0.9) return "#00FF00";
  if (confidence >= 0.7) return "#FFA500";
  return "#FF0000";
}

// Import React for useState
import React from "react";
