'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode;
}

export async function continueConversation(messages: Message[]) {
  // Placeholder - nanti kita integrasikan dengan Roboflow API
  const lastMessage = messages[messages.length - 1];
  
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `Echo: ${lastMessage.content}`,
      },
    ],
  };
}
