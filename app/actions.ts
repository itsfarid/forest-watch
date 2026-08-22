'use server';

/**
 * Server Actions
 * Thin wrapper around services - handles Next.js server action orchestration
 */

import { checkAIAvailability as checkAI, generateChatCompletion } from '@/lib/services/openai.service';
import { callRoboflowInferenceAPI, isRoboflowConfigured, getRoboflowConfig } from '@/lib/services/roboflow.service';
import { Message, ConversationResult } from '@/lib/types/message.types';
import { AppError, openaiErrorFromException } from '@/lib/errors/api-errors';
import { ROBOFLOW_DEFAULTS } from '@/lib/config/constants';

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
  confidenceThreshold?: number
): Promise<ConversationResult> {
  const lastMessage = messages[messages.length - 1];
  
  if (!lastMessage || lastMessage.role !== 'user') {
    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: '⚠️ Invalid message format.',
        },
      ],
    };
  }

  const userContent = lastMessage.content;

  // Check if content is a base64 image (data URI)
  const isImageDataUri =
    typeof userContent === 'string' &&
    (userContent.startsWith('data:image/') || userContent.startsWith('data:application/octet-stream'));

  // Check if content is a URL (http/https)
  const isImageUrl =
    typeof userContent === 'string' &&
    (userContent.startsWith('http://') || userContent.startsWith('https://'));

  // If it's an image, process with Roboflow
  if (isImageDataUri || isImageUrl) {
    return await handleImageAnalysis(messages, userContent, isImageUrl, confidenceThreshold);
  }

  // Otherwise, process as text chat with OpenAI
  return await handleTextChat(messages);
}

/**
 * Handle image analysis using Roboflow
 */
async function handleImageAnalysis(
  messages: Message[],
  imageContent: string,
  isUrl: boolean,
  clientConfidenceThreshold?: number
): Promise<ConversationResult> {
  // Check if Roboflow is configured
  if (!isRoboflowConfigured()) {
    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            '❌ Roboflow is not configured. Please set ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ID environment variables.',
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
              role: 'assistant',
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
            role: 'assistant',
            content: `❌ Error fetching image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  // Call Roboflow inference API
  const result = await callRoboflowInferenceAPI(imageDataUri, clientConfidenceThreshold);

  if (!result.success) {
    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: `❌ Roboflow inference failed: ${result.error || 'Unknown error'}`,
        },
      ],
    };
  }

  const config = getRoboflowConfig();
  const predictions = result.predictions;

  // Build response message
  let responseContent = '';

  if (predictions.length === 0) {
    responseContent = '✅ Image analyzed successfully. No deforestation detected in this image.';
    
    // In debug mode, include visualization if available
    if (result.debugInfo && result.visualization) {
      responseContent += `\n\n🔍 Debug: ${result.debugInfo}`;
    }
  } else {
    const highConfidencePreds = predictions.filter(
      (p) => p.confidence >= (clientConfidenceThreshold ?? config.confidenceThreshold ?? ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD)
    );

    responseContent = `✅ Image analyzed with Roboflow model (${config.modelId ?? 'roboflow model'}).\n\n`;
    responseContent += `**Detections Found:** ${predictions.length}\n`;
    responseContent += `**High Confidence:** ${highConfidencePreds.length}\n\n`;

    if (highConfidencePreds.length > 0) {
      responseContent += '**High Confidence Detections:**\n';
      highConfidencePreds.forEach((pred, idx) => {
        responseContent += `${idx + 1}. ${pred.class} - ${(pred.confidence * 100).toFixed(1)}% confidence\n`;
        responseContent += `   Location: (${Math.round(pred.x)}, ${Math.round(pred.y)}), Size: ${Math.round(pred.width)}x${Math.round(pred.height)}\n`;
      });
    }

    if (predictions.length > highConfidencePreds.length) {
      const lowConfidencePreds = predictions.filter(
        (p) => p.confidence < (clientConfidenceThreshold ?? config.confidenceThreshold ?? ROBOFLOW_DEFAULTS.CONFIDENCE_THRESHOLD)
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
    role: 'assistant',
    content: responseContent,
    imageUrl: result.visualization || imageDataUri,
  };

  return {
    messages: [...messages, assistantMessage],
  };
}

/**
 * Handle text chat using OpenAI
 */
async function handleTextChat(messages: Message[]): Promise<ConversationResult> {
  try {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const responseContent = await generateChatCompletion(formattedMessages);

    const assistantMessage: Message = {
      role: 'assistant',
      content: responseContent || '⚠️ No response generated.',
    };

    return {
      messages: [...messages, assistantMessage],
    };
  } catch (error) {
    const appErr = error instanceof AppError
      ? error
      : openaiErrorFromException(error);
    console.error('continueConversation text chat error:', appErr.technicalMessage);

    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content: `❌ ${appErr.userMessage}`,
        },
      ],
    };
  }
}

/**
 * Fetch image from URL and convert to data URI
 */
async function fetchImageAsDataUri(url: string): Promise<{
  success: boolean;
  dataUri?: string;
  error?: string;
}> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return {
        success: false,
        error: 'URL does not point to an image',
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUri = `data:${contentType};base64,${base64}`;

    return {
      success: true,
      dataUri,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch image',
    };
  }
}
