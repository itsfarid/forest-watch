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

export async function checkAIAvailability() {
  // Check if API key exists
  const hasApiKey = !!process.env.ROBOFLOW_API_KEY;
  
  return {
    available: hasApiKey,
    message: hasApiKey 
      ? 'AI detection is ready' 
      : 'Please configure ROBOFLOW_API_KEY in environment variables',
  };
}