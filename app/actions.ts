'use server';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  visualizedImage?: string;
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
    console.log('Calling Roboflow with URL:', imageUrl);
    
    // Konfigurasi API: confidence=40 (minimal yakin 40%), overlap=30 (gabungkan kotak yang tumpang tindih)
    const roboflowUrl = 'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4?confidence=40&overlap=30';
    
    const response = await fetch(
      roboflowUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          inputs: {
            image: { 
              type: imageUrl.startsWith('data:') ? 'base64' : 'url', 
              value: imageUrl.startsWith('data:') ? imageUrl.split(',')[1] : imageUrl 
            },
          },
        }),
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
  
  const isBase64 = lastMessage.content.startsWith('data:image/');
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = lastMessage.content.match(urlPattern);
  const imageUrl = isBase64 ? lastMessage.content : (urls ? urls[0] : null);
   
  if (imageUrl) {
    try {
      const result = await analyzeForestImage(imageUrl);
      
      const outputs = result.outputs || [];
      const detectionCount = outputs.find(o => o.count_objects !== undefined)?.count_objects || 0;
      const predictions = outputs.find(o => o.predictions)?.predictions || [];
      const visualizedImageRaw = outputs.find(o => o.output_image)?.output_image?.value;
      
      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      
      if (detectionCount > 0) {
        responseContent += `⚠️ ALERT: Potential Deforestation Detected\n`;
        responseContent += `📊 Areas identified: ${detectionCount}\n\n`;
        
        if (predictions.length > 0) {
          const classNames = predictions.map(p => p.class);
          const uniqueClasses = Array.from(new Set(classNames));
          
          uniqueClasses.forEach((cls) => {
            const classItems = predictions.filter(p => p.class === cls);
            const count = classItems.length;
            const totalConf = classItems.reduce((sum, p) => sum + p.confidence, 0);
            const avgConf = totalConf / count;
            
            responseContent += `• ${cls}: ${count} spots (avg ${(avgConf * 100).toFixed(0)}% confidence)\n`;
          });
        }
      } else {
        responseContent += `✅ Result: Healthy Forest\nNo deforestation indicators detected above confidence threshold.`;
      }
      
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: responseContent,
            visualizedImage: visualizedImageRaw, 
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
            content: `❌ Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}. Try a clearer image.`,
          },
        ],
      };
    }
  }
  
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `🌲 Forest Watch AI Ready.\nUpload an image to check for deforestation.`,
      },
    ],
  };
}

// INI YANG SEBELUMNYA HILANG:
export async function checkAIAvailability() {
  const hasApiKey = !!process.env.ROBOFLOW_API_KEY;
   
  return {
    available: hasApiKey,
    message: hasApiKey 
      ? '🌲 Forest detection AI is ready' 
      : '⚠️ Please configure ROBOFLOW_API_KEY in environment variables',
  };
}