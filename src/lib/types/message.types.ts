/**
 * Message types for chat/conversation functionality
 */
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
};

export type ConversationResult = {
  messages: Message[];
};
