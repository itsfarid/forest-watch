'use server';

// Ubah interface: Ganti 'display' menjadi 'visualizedImage' (string)
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  visualizedImage?: string; // Data gambar hasil deteksi (base64)
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
            image: { 
              type: imageUrl.startsWith('data:') ? 'base64' : 'url', 
              value: imageUrl.startsWith('data:') ? imageUrl.split(',')[1] : imageUrl 
            },
          },
        }),
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
      
      // Ambil data gambar mentah saja
      const visualizedImageRaw = outputs.find(o => o.output_image)?.output_image?.value;
      
      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      responseContent += `📊 Objects detected: ${detectionCount}\n\n`;
      
      if (predictions.length > 0) {
        responseContent += `Detected objects:\n`;
        const classNames = predictions.map(p => p.class);
        const uniqueClasses = Array.from(new Set(classNames));
        
        uniqueClasses.forEach((cls, idx) => {
          const classItems = predictions.filter(p => p.class === cls);
          const count = classItems.length;
          const totalConf = classItems.reduce((sum, p) => sum + p.confidence, 0);
          const avgConf = totalConf / count;
          responseContent += `${idx + 1}. ${cls}: ${count} items (avg ${(avgConf * 100).toFixed(1)}% confidence)\n`;
        });
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
            visualizedImage: visualizedImageRaw, // Kirim data string saja, bukan JSX
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
  
  // Default fallback
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `🌲 Forest Watch AI\n\nPlease provide an image URL to analyze for deforestation detection, or upload an image file.\n\nExample:\nhttps://example.com/forest-image.jpg\n\nI'll detect and count objects related to deforestation in the image.`,
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