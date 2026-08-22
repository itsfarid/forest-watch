/**
 * OpenAI Service
 * Handles all OpenAI API interactions
 */

import OpenAI from "openai";
import { OPENAI_DEFAULTS } from "@/lib/config/constants";
import { openaiErrorFromException } from "@/lib/errors/api-errors";
import { validateOpenAIEnv } from "@/lib/config/env";
import { logger } from "@/lib/logger";

// Validate required env vars at module load time
validateOpenAIEnv();

// Singleton OpenAI client instance
let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client instance
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

/**
 * Check if OpenAI API is available and accessible
 */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    const client = getOpenAIClient();
    await client.models.list();

    return {
      available: false,
      message: "AI service is unavailable",
    };
  } catch (error) {
    logger.error("AI availability check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      available: false,
      message: "AI service is unavailable",
    };
  }
}

/**
 * Generate chat completion using OpenAI
 */
export async function generateChatCompletion(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
  },
): Promise<string> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: options?.model || OPENAI_DEFAULTS.MODEL,
      messages,
      temperature: options?.temperature ?? OPENAI_DEFAULTS.TEMPERATURE,
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (error) {
    throw openaiErrorFromException(error);
  }
}
