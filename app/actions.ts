'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode;
  imageUrl?: string; // Add this to store image for display
}

interface RoboflowResponse {
  outputs: Array<{
    output_image?: {
      type: string;
      value: string;
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
    console.log('Calling Roboflow with image...');
    
    // Check if it's base64 or URL
    const isBase64 = imageUrl.startsWith('data:image');
    
    const requestBody = isBase64 
      ? {
          api_key: apiKey,
          inputs: {
            image: { 
              type: 'base64', 
              value: imageUrl.split(',')[1] // Remove data:image/xxx;base64, prefix
            },
          },
        }
      : {
          api_key: apiKey,
          inputs: {
            image: { type: 'url', value: imageUrl },
          },
        };
    
    const response = await fetch(
      'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4?confidence=85&overlap=30',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const responseText = await response.text();
    console.log('Roboflow response status:', response.status);

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
  
  // Check if message is base64 image
  const isBase64Image = lastMessage.content.startsWith('data:image');
  
  // Check if message contains image URL
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = lastMessage.content.match(urlPattern);
  
  const imageUrl = isBase64Image ? lastMessage.content : (urls && urls.length > 0 ? urls[0] : null);
  
  if (imageUrl) {
    const isImageUrl = isBase64Image || 
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(imageUrl) || 
      imageUrl.includes('unsplash.com') ||
      imageUrl.includes('images') ||
      imageUrl.includes('photo') ||
      imageUrl.includes('imgs.') ||
      imageUrl.includes('upload') ||
      imageUrl.includes('mongabay');
    
    if (isImageUrl) {
      try {
        const result = await analyzeForestImage(imageUrl);
        
        const outputs = result.outputs || [];
        const firstOutput = outputs[0] || {};
        const detectionCount = firstOutput.count_objects || 0;
        
        console.log('Detection count:', detectionCount);
        
        let responseContent = `🌲 Forest Analysis Results:\n\n`;
        
        // WORKAROUND: Use detection count with adjusted thresholds
        // Since model over-detects, we classify based on relative severity
        if (detectionCount === 0) {
          responseContent += `✅ Deforestation Status: NOT DETECTED\n\n`;
          responseContent += `The analyzed area appears to be healthy forest with no deforestation indicators.`;
        } else if (detectionCount < 120) {
          // LOW severity: mostly forest with minimal clearing
          responseContent += `✅ Deforestation Status: MINIMAL\n\n`;
          responseContent += `📊 Minor disturbances detected: ${detectionCount} locations\n`;
          responseContent += `📈 Forest coverage: High (~${(100 - (detectionCount / 200) * 100).toFixed(1)}%)\n\n`;
          responseContent += `💡 Assessment: The area is predominantly healthy forest. Some natural gaps or minimal human activity detected, but overall forest integrity is maintained.`;
        } else if (detectionCount < 140) {
          // MEDIUM severity
          responseContent += `🔶 Deforestation Status: MODERATE\n\n`;
          responseContent += `📊 Affected areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation coverage: ~${Math.min((detectionCount / 200) * 100, 100).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Moderate deforestation detected. Significant forest clearing is occurring with scattered cleared patches throughout the area.`;
        } else {
          // HIGH severity
          responseContent += `🔴 Deforestation Status: SEVERE\n\n`;
          responseContent += `📊 Affected areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation coverage: ~${Math.min((detectionCount / 200) * 100, 100).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Severe deforestation detected. Large-scale forest clearing is evident with major habitat loss and environmental impact.`;
        }
        
        return {
          messages: [
            ...messages,
            {
              role: 'assistant' as const,
              content: responseContent,
              imageUrl: imageUrl, // Pass the analyzed image URL
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
              content: `❌ Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  }
  
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `🌲 Forest Watch AI\n\nUpload an image or paste URL to analyze for deforestation detection.\n\nI'll check if there are any deforestation indicators in the image.`,
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