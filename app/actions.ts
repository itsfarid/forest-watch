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
        const detectionCount = outputs.find(o => o.count_objects !== undefined)?.count_objects || 0;
        const predictions = outputs.find(o => o.predictions)?.predictions || [];
        
        console.log('Detection count:', detectionCount);
        console.log('Predictions:', predictions);
        
        let responseContent = `🌲 Forest Analysis Results:\n\n`;
        
        // Check if there are any predictions
        if (predictions.length === 0 || detectionCount === 0) {
          responseContent += `✅ Deforestation area: NOT FOUND\n\n`;
          responseContent += `The analyzed area appears to be healthy forest with no deforestation indicators detected.`;
        } else {
          // Count unique classes
          const classNames = predictions.map(p => p.class);
          const uniqueClasses = Array.from(new Set(classNames));
          
          console.log('Unique classes:', uniqueClasses);
          
          // Calculate severity based on detections
          const deforestationPercentage = Math.min(((detectionCount / 100) * 100), 100).toFixed(1);
          
          let severity = 'LOW';
          if (detectionCount > 120) {
            severity = 'HIGH';
          } else if (detectionCount > 80) {
            severity = 'MEDIUM';
          }
          
          responseContent += `⚠️ Deforestation area: DETECTED (${severity} SEVERITY)\n`;
          responseContent += `📊 Deforested areas found: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated coverage: ~${deforestationPercentage}%\n\n`;
          
          responseContent += `Detected indicators:\n`;
          uniqueClasses.forEach((cls, idx) => {
            const classItems = predictions.filter(p => p.class === cls);
            const count = classItems.length;
            const totalConf = classItems.reduce((sum, p) => sum + p.confidence, 0);
            const avgConf = totalConf / count;
            responseContent += `${idx + 1}. ${cls}: ${count} areas (${(avgConf * 100).toFixed(1)}% confidence)\n`;
          });
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