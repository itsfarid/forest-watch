'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode;
  visualizationImage?: string;
}

interface RoboflowResponse {
  outputs: Array<{
    output_image?: {
      type: string;
      value: string;
    };
    count_objects?: number;
  }>;
}

export async function analyzeForestImage(imageUrl: string) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  
  if (!apiKey) {
    throw new Error('ROBOFLOW_API_KEY not configured');
  }

  try {
    console.log('Calling Roboflow Workflow...');
    
    const isBase64 = imageUrl.startsWith('data:image');
    
    const requestBody = {
      api_key: apiKey,
      inputs: {
        image: isBase64 
          ? { type: 'base64', value: imageUrl.split(',')[1] }
          : { type: 'url', value: imageUrl }
      }
    };
    
    const response = await fetch(
      'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const responseText = await response.text();

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
  
  const isBase64Image = lastMessage.content.startsWith('data:image');
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
        const visualizationImage = firstOutput.output_image?.value;
        
        console.log('Detection count:', detectionCount);
        console.log('Has visualization:', !!visualizationImage);
        
        let responseContent = `🌲 Forest Analysis Results:\n\n`;
        
        if (detectionCount === 0) {
          responseContent += `✅ Deforestation Status: NOT DETECTED\n\n`;
          responseContent += `The analyzed area appears to be healthy forest with no deforestation indicators.`;
        } else if (detectionCount < 50) {
          responseContent += `⚠️ Deforestation Status: MINIMAL\n\n`;
          responseContent += `📊 Deforested areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Forest coverage: High (~${(100 - (detectionCount / 200) * 100).toFixed(1)}%)\n\n`;
          responseContent += `💡 Assessment: Minor deforestation detected. The area is predominantly healthy forest.`;
        } else if (detectionCount < 80) {
          responseContent += `🔶 Deforestation Status: MODERATE\n\n`;
          responseContent += `📊 Deforested areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation: ~${Math.min((detectionCount / 200) * 100, 100).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Moderate deforestation with scattered cleared patches.`;
        } else {
          responseContent += `🔴 Deforestation Status: SEVERE\n\n`;
          responseContent += `📊 Deforested areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation: ~${Math.min((detectionCount / 200) * 100, 100).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Severe deforestation with major habitat loss.`;
        }
        
        return {
          messages: [
            ...messages,
            {
              role: 'assistant' as const,
              content: responseContent,
              visualizationImage: visualizationImage,
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
        content: `🌲 Forest Watch AI\n\nUpload an image or paste URL to analyze for deforestation detection.`,
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