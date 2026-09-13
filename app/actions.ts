"use server";

/**
 * Server Actions
 * Thin wrapper around services - handles Next.js server action orchestration
 */

import {
  checkAIAvailability as checkAI,
  generateChatCompletion,
} from "@/lib/services/openai.service";
import {
  callRoboflowInferenceAPI,
  isRoboflowConfigured,
  getRoboflowConfig,
} from "@/lib/services/roboflow.service";
import { Message, ConversationResult } from "@/lib/types/message.types";
import { AppError, openaiErrorFromException } from "@/lib/errors/api-errors";
import { ROBOFLOW_DEFAULTS } from "@/lib/config/constants";
import { validateImageDataUri } from "@/lib/validation/image";
import { sanitizeTextInput } from "@/lib/validation/text";
import { logger } from "@/lib/logger";

// Re-export types for backward compatibility
export type { Message };

/**
 * Check if AI service (OpenAI) is available
 */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  return checkAI();
}

/**
 * Continue conversation with AI
 * Handles both image analysis (via Roboflow) and text chat (via OpenAI)
 */
export async function continueConversation(
  messages: Message[],
  confidenceThreshold?: number,
): Promise<ConversationResult> {
  // Cap messages array to prevent excessive token usage / memory abuse
  const MAX_MESSAGES = 50;
  const trimmedMessages = messages.slice(-MAX_MESSAGES);

  // Clamp confidence threshold to valid range server-side
  const clampedThreshold =
    confidenceThreshold !== undefined
      ? Math.min(1, Math.max(0, confidenceThreshold))
      : undefined;

  const lastMessage = trimmedMessages[trimmedMessages.length - 1];

  if (!lastMessage || lastMessage.role !== "user") {
    return {
      messages: [
        ...trimmedMessages,
        {
          role: "assistant",
          content: "⚠️ Invalid message format.",
        },
      ],
    };
  }

  const userContent = lastMessage.content;

  // Check if content is a base64 image (data URI)
  const isImageDataUri =
    typeof userContent === "string" &&
    (userContent.startsWith("data:image/") ||
      userContent.startsWith("data:application/octet-stream"));

  // Check if content is a URL (http/https)
  const isImageUrl =
    typeof userContent === "string" &&
    (userContent.startsWith("http://") || userContent.startsWith("https://"));

  // If it's an image, process with Roboflow
  if (isImageDataUri || isImageUrl) {
    return await handleImageAnalysis(
      trimmedMessages,
      userContent,
      isImageUrl,
      clampedThreshold,
    );
  }

  // Otherwise, process as text chat with OpenAI
  return await handleTextChat(trimmedMessages);
}

/**
 * Handle image analysis using Roboflow
 */
async function handleImageAnalysis(
  messages: Message[],
  imageContent: string,
  isUrl: boolean,
  clientConfidenceThreshold?: number,
): Promise<ConversationResult> {
  // Check if Roboflow is configured
  if (!isRoboflowConfigured()) {
    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content:
            "❌ Roboflow is not configured. Please set ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID environment variables.",
        },
      ],
    };
  }

  let imageDataUri = imageContent;

  // If it's a URL, fetch and convert to data URI
  if (isUrl) {
    try {
      const fetchResult = await fetchImageAsDataUri(imageContent);
      if (!fetchResult.success) {
        return {
          messages: [
            ...messages,
            {
              role: "assistant",
              content: `❌ Failed to fetch image: ${fetchResult.error}`,
            },
          ],
        };
      }
      imageDataUri = fetchResult.dataUri!;
    } catch (error) {
      return {
        messages: [
          ...messages,
          {
            role: "assistant",
            content: `❌ Error fetching image: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }

  // Server-side image validation -- must run before sending to Roboflow
  const imageValidationError = validateImageDataUri(imageDataUri);
  if (imageValidationError) {
    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `❌ ${imageValidationError}`,
        },
      ],
    };
  }

  // Call Roboflow inference API
  const result = await callRoboflowInferenceAPI(
    imageDataUri,
    clientConfidenceThreshold,
  );

  if (!result.success) {
    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `❌ Roboflow inference failed: ${result.error || "Unknown error"}`,
        },
      ],
    };
  }

  const config = getRoboflowConfig();
  const predictions = result.predictions;

  // Build response message
  let responseContent = "";

  if (predictions.length === 0) {
    responseContent =
      "✅ Image analyzed successfully. No deforestation detected in this image.";

    // In debug mode, include visualization if available
    if (result.debugInfo && result.visualization) {
      responseContent += `\n\n🔍 Debug: ${result.debugInfo}`;
    }
  } else {
    const highConfidencePreds = predictions.filter(
      (p) =>
        p.confidence >=
        (clientConfidenceThreshold ??
          config.confidenceThreshold ??
          ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD),
    );

    responseContent = `✅ Image analyzed with Roboflow model (${config.modelId ?? "roboflow model"}).\n\n`;
    responseContent += `**Detections Found:** ${predictions.length}\n`;
    responseContent += `**High Confidence:** ${highConfidencePreds.length}\n\n`;

    if (highConfidencePreds.length > 0) {
      responseContent += "**High Confidence Detections:**\n";
      highConfidencePreds.forEach((pred, idx) => {
        responseContent += `${idx + 1}. ${pred.class} - ${(pred.confidence * 100).toFixed(1)}% confidence\n`;
        responseContent += `   Location: (${Math.round(pred.x)}, ${Math.round(pred.y)}), Size: ${Math.round(pred.width)}x${Math.round(pred.height)}\n`;
      });
    }

    if (predictions.length > highConfidencePreds.length) {
      const lowConfidencePreds = predictions.filter(
        (p) =>
          p.confidence <
          (clientConfidenceThreshold ??
            config.confidenceThreshold ??
            ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD),
      );
      responseContent += `\n**Lower Confidence Detections:** ${lowConfidencePreds.length}\n`;
      lowConfidencePreds.slice(0, 3).forEach((pred, idx) => {
        responseContent += `${idx + 1}. ${pred.class} - ${(pred.confidence * 100).toFixed(1)}%\n`;
      });
      if (lowConfidencePreds.length > 3) {
        responseContent += `... and ${lowConfidencePreds.length - 3} more\n`;
      }
    }

    responseContent += `\n💡 **Tip:** Draw bounding boxes on a canvas element using the provided coordinates.`;
  }

  const assistantMessage: Message = {
    role: "assistant",
    content: responseContent,
    imageUrl: result.visualization || imageDataUri,
    predictions: predictions.length > 0 ? predictions : undefined,
  };

  return {
    messages: [...messages, assistantMessage],
  };
}

/**
 * Handle text chat using OpenAI
 */
async function handleTextChat(
  messages: Message[],
): Promise<ConversationResult> {
  try {
    // Sanitize user messages and wrap with delimiters to mitigate prompt injection
    const formattedMessages = messages.map((msg) => {
      if (msg.role !== "user") return { role: msg.role, content: msg.content };
      const sanitized = sanitizeTextInput(msg.content);
      return {
        role: msg.role,
        // Delimiters prevent injected instructions from being interpreted as system commands
        content: `<user_message>${sanitized}</user_message>`,
      };
    });

    const responseContent = await generateChatCompletion(formattedMessages);

    const assistantMessage: Message = {
      role: "assistant",
      content: responseContent || "⚠️ No response generated.",
    };

    return {
      messages: [...messages, assistantMessage],
    };
  } catch (error) {
    const appErr =
      error instanceof AppError ? error : openaiErrorFromException(error);
    logger.error("continueConversation text chat error", {
      technical: appErr.technicalMessage,
    });

    return {
      messages: [
        ...messages,
        {
          role: "assistant",
          content: `❌ ${appErr.userMessage}`,
        },
      ],
    };
  }
}

/**
 * Validate and sanitize a URL before fetching.
 * Prevents SSRF by blocking private/internal IP ranges and non-HTTPS URLs.
 */
function validateFetchUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Invalid URL format.";
  }

  // Only allow HTTPS
  if (parsed.protocol !== "https:") {
    return "Only HTTPS URLs are supported.";
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private/internal ranges, metadata endpoints, and localhost
  const blockedPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // link-local / AWS metadata
    /^::1$/, // IPv6 loopback
    /^fc00:/, // IPv6 private
    /^fe80:/, // IPv6 link-local
    /^0\./,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(hostname))) {
    return "URL points to a private or internal address, which is not allowed.";
  }

  return null; // valid
}

/**
 * Fetch image from URL and convert to data URI
 */
async function fetchImageAsDataUri(url: string): Promise<{
  success: boolean;
  dataUri?: string;
  error?: string;
}> {
  // SSRF protection: validate URL before fetching
  const urlError = validateFetchUrl(url);
  if (urlError) {
    return { success: false, error: urlError };
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.startsWith("image/")) {
      return {
        success: false,
        error: "URL does not point to an image",
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${contentType};base64,${base64}`;

    return {
      success: true,
      dataUri,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch image",
    };
  }
}
