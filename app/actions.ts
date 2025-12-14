'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode;
}

interface RoboflowResponse {
  outputs: Array<{
    image?: {
      value: string; 
    };
    count?: number;
    predictions?: Array<{
      class: string;
      confidence: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }>;
}

export async function analyzeForestImage(imageUrl: string) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  
  if (!apiKey) {
    throw new Error('ROBOFLOW_API_KEY not configured');
  }

  try {
    const response = await fetch(
      'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          inputs: {
            image: { type: 'url', value: imageUrl },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.statusText}`);
    }

    const result: RoboflowResponse = await response.json();
    return result;
  } catch (error) {
    console.error('Error calling Roboflow:', error);
    throw error;
  }
}

export async function continueConversation(messages: Message[]) {
  const lastMessage = messages[messages.length - 1];
  
  // Check if message contains image URL
  const urlPattern = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp))/gi;
  const imageUrls = lastMessage.content.match(urlPattern);
  
  if (imageUrls && imageUrls.length > 0) {
    try {
      const result = await analyzeForestImage(imageUrls[0]);
      
      // Extract analysis results
      const outputs = result.outputs || [];
      const detectionCount = outputs.find(o => o.count !== undefined)?.count || 0;
      const predictions = outputs.find(o => o.predictions)?.predictions || [];
      const visualizedImage = outputs.find(o => o.image)?.image?.value;
      
      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      responseContent += `📊 Detections found: ${detectionCount}\n\n`;
      
      if (predictions.length > 0) {
        responseContent += `Detected objects:\n`;
        predictions.forEach((pred, idx) => {
          responseContent += `${idx + 1}. ${pred.class} (${(pred.confidence * 100).toFixed(1)}% confidence)\n`;
        });
      }
      
      if (visualizedImage) {
        responseContent += `\n✅ Visualization generated successfully`;
      }
      
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: responseContent,
          },
        ],
      };
    } catch (error) {
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: `❌ Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure you provide a valid image URL.`,
          },
        ],
      };
    }
  }
  
  // If no image URL, provide instructions
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `🌲 Forest Watch AI\n\nPlease provide an image URL to analyze for deforestation detection.\n\nExample:\nhttps://example.com/forest-image.jpg\n\nI'll detect and count objects related to deforestation in the image.`,
      },
    ],
  };
}

export async function checkAIAvailability() {
  const hasApiKey = !!process.env.ROBOFLOW_API_KEY;
  
  return {
    available: hasApiKey,
    message: hasApiKey 
      ? '🌲 Forest detection AI is ready' 
      : '⚠️ Please configure ROBOFLOW_API_KEY in environment variables',
  };
}