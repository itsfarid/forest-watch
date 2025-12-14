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
    // Kita gunakan workflow yang sama
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
      // Cek apakah error karena gambar terlalu besar atau server error
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
      
      // --- PERBAIKAN: EKSTRAKSI YANG LEBIH AMAN (DEFENSIVE) ---
      
      // 1. Pastikan outputs ada dan merupakan array
      const outputs = Array.isArray(result.outputs) ? result.outputs : [];
      
      // 2. Ambil output pertama (jika ada)
      const firstOutput = outputs.length > 0 ? outputs[0] : {};
      
      // 3. Ambil predictions, dan PAKSA menjadi array jika null/undefined
      //    (Menghindari error "filter is not a function")
      //    @ts-ignore (untuk menghandle kasus dimana API mengembalikan null tapi tipe kita Array)
      const rawPredictions = Array.isArray(firstOutput.predictions) ? firstOutput.predictions : [];
      
      // 4. Ambil gambar
      // @ts-ignore
      const rawImage = firstOutput.output_image?.value;
      
      // --- FILTERING ---
      const THRESHOLD = 0.6; // 60% confidence
      const validPredictions = rawPredictions.filter(p => p.confidence >= THRESHOLD);
      const detectionCount = validPredictions.length;

      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      let finalVisualizedImage = undefined;

      if (detectionCount > 0) {
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

        finalVisualizedImage = rawImage;
      } else {
        // Jika 0 deteksi valid
        responseContent += `✅ Result: Healthy Forest\nNo deforestation indicators detected.\n(Filtered ${rawPredictions.length} low-confidence noise signals)`;
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