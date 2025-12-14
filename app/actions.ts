'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode;
}

interface RoboflowResponse {
  outputs: Array<{
    output_image?: {
      type: string;
      value: string; // base64 image
    };
    count_objects?: number;
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
    console.log('Calling Roboflow with URL:', imageUrl);
    
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

    const responseText = await response.text();
    console.log('Roboflow response status:', response.status);
    console.log('Roboflow response:', responseText);

    if (!response.ok) {
      throw new Error(`Roboflow API error (${response.status}): ${responseText}`);
    }

    const result: RoboflowResponse = JSON.parse(responseText);
    return result;
  } catch (error) {
    console.error('Error calling Roboflow:', error);
    throw error;
  }
}

export async function continueConversation(messages: Message[]) {
  const lastMessage = messages[messages.length - 1];
  
  // Check if message contains image URL (improved regex)
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = lastMessage.content.match(urlPattern);
  
  if (urls && urls.length > 0) {
    const imageUrl = urls[0];
    
    // Check if URL looks like an image
    const isImageUrl = /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(imageUrl) || 
                      imageUrl.includes('unsplash.com') ||
                      imageUrl.includes('images') ||
                      imageUrl.includes('photo');
    
    if (isImageUrl) {
      try {
        const result = await analyzeForestImage(imageUrl);
        
        // Extract analysis results
        const outputs = result.outputs || [];
        const detectionCount = outputs.find(o => o.count_objects !== undefined)?.count_objects || 0;
        const predictions = outputs.find(o => o.predictions)?.predictions || [];
        const visualizedImage = outputs.find(o => o.output_image)?.output_image?.value;
        
        let responseContent = `🌲 Forest Analysis Results:\n\n`;
        responseContent += `📊 Objects detected: ${detectionCount}\n\n`;
        
        if (predictions.length > 0) {
          responseContent += `Detected objects:\n`;
          const uniqueClasses = [...new Set(predictions.map(p => p.class))];
          uniqueClasses.forEach((cls, idx) => {
            const count = predictions.filter(p => p.class === cls).length;
            const avgConf = predictions
              .filter(p => p.class === cls)
              .reduce((sum, p) => sum + p.confidence, 0) / count;
            responseContent += `${idx + 1}. ${cls}: ${count} items (avg ${(avgConf * 100).toFixed(1)}% confidence)\n`;
          });
        }
        
        if (visualizedImage) {
          responseContent += `\n✅ Analysis complete with visualization`;
        }
        
        if (detectionCount === 0) {
          responseContent = `🌲 Forest Analysis Results:\n\n✅ No deforestation indicators detected in this image.\nThe area appears to be healthy forest.`;
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
        console.error('Full error:', error);
        return {
          messages: [
            ...messages,
            {
              role: 'assistant' as const,
              content: `❌ Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try:\n1. Check if the image URL is publicly accessible\n2. Try a different image URL\n3. Make sure the URL is a direct link to an image file`,
            },
          ],
        };
      }
    }
  }
  
  // If no valid image URL, provide instructions
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