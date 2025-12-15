'use server';

import OpenAI from 'openai';

/* =========================
   Types
   ========================= */
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
};

/* =========================
   OpenAI Client
   ========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   Check AI Availability
   ========================= */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    // Simple lightweight check
    await openai.models.list();

    return {
      available: true,
      message: 'AI service is online',
    };
  } catch (error) {
    console.error('AI availability check failed:', error);

    return {
      available: false,
      message: 'AI service is unavailable',
    };
  }
}

/* =========================
   Continue Conversation
   ========================= */
export async function continueConversation(
  messages: Message[]
): Promise<{ messages: Message[] }> {
  try {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: formattedMessages,
      temperature: 0.3,
    });

    const assistantMessage: Message = {
      role: 'assistant',
      content:
        response.choices[0]?.message?.content ??
        '⚠️ No response generated.',
    };

    return {
      messages: [...messages, assistantMessage],
    };
  } catch (error) {
    console.error('continueConversation error:', error);

    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            '❌ Failed to process request. Please check API key or try again.',
        },
      ],
    };
  }
}
