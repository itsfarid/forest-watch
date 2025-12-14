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
    
    // URL tetap sama, tapi kita tidak berharap banyak pada query params ini
    // karena workflow sering mengabaikannya. Kita akan filter manual di bawah.
    const response = await fetch(
      'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4?confidence=60&overlap=30',
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
      const rawPredictions = outputs.find(o => o.predictions)?.predictions || [];
      const rawImage = outputs.find(o => o.output_image)?.output_image?.value;
      
      // --- LOGIKA FILTERING MANUAL DI SINI ---
      // Kita hanya ambil prediksi yang confidence-nya > 0.6 (60%)
      const THRESHOLD = 0.6; 
      const validPredictions = rawPredictions.filter(p => p.confidence >= THRESHOLD);
      const detectionCount = validPredictions.length;

      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      let finalVisualizedImage = undefined;

      if (detectionCount > 0) {
        // Jika setelah difilter masih ada deteksi, berarti BENAR ada deforestasi
        responseContent += `⚠️ ALERT: Potential Deforestation Detected\n`;
        responseContent += `📊 Areas identified: ${detectionCount} (High Confidence)\n\n`;
        
        const classNames = validPredictions.map(p => p.class);
        const uniqueClasses = Array.from(new Set(classNames));
        
        uniqueClasses.forEach((cls) => {
          const classItems = validPredictions.filter(p => p.class === cls);
          const count = classItems.length;
          const totalConf = classItems.reduce((sum, p) => sum + p.confidence, 0);
          const avgConf = totalConf / count;
          
          responseContent += `• ${cls}: ${count} spots (avg ${(avgConf * 100).toFixed(0)}% confidence)\n`;
        });

        // Tampilkan gambar hasil (walaupun mungkin agak berantakan, tapi datanya valid)
        finalVisualizedImage = rawImage;

      } else {
        // Jika setelah difilter hasilnya 0 (padahal API mungkin kirim 100+ sampah)
        // Kita nyatakan BERSIH.
        responseContent += `✅ Result: Healthy Forest\nNo deforestation indicators detected.\n(Filtered ${rawPredictions.length} low-confidence noise signals)`;
        
        // PENTING: Jangan tampilkan visualizedImage dari server karena isinya kotak-kotak sampah.
        // Biarkan undefined, jadi UI hanya menampilkan teks "Healthy Forest".
        finalVisualizedImage = undefined;
      }
      
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: responseContent,
            visualizedImage: finalVisualizedImage, 
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

export async function checkAIAvailability() {
  const hasApiKey = !!process.env.ROBOFLOW_API_KEY;
   
  return {
    available: hasApiKey,
    message: hasApiKey 
      ? '🌲 Forest detection AI is ready' 
      : '⚠️ Please configure ROBOFLOW_API_KEY in environment variables',
  };
}