'use server';

import OpenAI from 'openai';

/* =========================
   Message Type (FIXED)
   ========================= */
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string; // ✅ OPTIONAL (FIX ERROR VERCEL)
};

/* =========================
   OpenAI Client
   ========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   Continue Conversation
   ========================= */
export async function continueConversation(
  messages: Message[]
): Promise<{ messages: Message[] }> {
  try {
    // Convert messages to OpenAI format
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
