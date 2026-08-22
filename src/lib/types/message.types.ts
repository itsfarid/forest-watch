/**
 * Message types for chat/conversation functionality
 */
import { RoboflowPrediction } from '@/lib/types/roboflow.types';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  /** Raw predictions for SVG overlay rendering — only present on image analysis results */
  predictions?: RoboflowPrediction[];
  /** Original image dimensions needed for accurate SVG overlay scaling */
  imageDimensions?: { width: number; height: number };
};

export type ConversationResult = {
  messages: Message[];
};
