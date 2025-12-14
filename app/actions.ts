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
    // REVISI: Kita set confidence SANGAT RENDAH (5%) di URL
    // Tujuannya: "Kirim semua data yang kamu punya, biar saya (kode) yang seleksi sendiri"
    const response = await fetch(
      'https://serverless.roboflow.com/students-eyecp/workflows/detect-count-and-visualize-4?confidence=5&overlap=30',
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
      
      // Ambil data dengan aman
      const outputs = Array.isArray(result.outputs) ? result.outputs : [];
      const firstOutput = outputs.length > 0 ? outputs[0] : {};
      
      // @ts-ignore
      const rawPredictions = Array.isArray(firstOutput.predictions) ? firstOutput.predictions : [];
      // @ts-ignore
      const rawImage = firstOutput.output_image?.value;
      
      // --- LOGIKA FILTER BARU ---
      // Kita turunkan standar jadi 25% (0.25). 
      // Jika AI yakin minimal 25%, kita anggap itu valid.
      const THRESHOLD = 0.25; 
      
      const validPredictions = rawPredictions.filter(p => p.confidence >= THRESHOLD);
      const detectionCount = validPredictions.length;
      
      // Hitung berapa yang dibuang (untuk info debugging)
      const filteredCount = rawPredictions.length - detectionCount;

      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      let finalVisualizedImage = undefined;

      if (detectionCount > 0) {
        responseContent += `⚠️ ALERT: Potential Deforestation Detected\n`;
        responseContent += `📊 Areas identified: ${detectionCount}\n`;
        responseContent += `(Filtered ${filteredCount} low-confidence signals)\n\n`;
        
        const classNames = validPredictions.map(p => p.class);
        const uniqueClasses = Array.from(new Set(classNames));
        
        uniqueClasses.forEach((cls) => {
          const classItems = validPredictions.filter(p => p.class === cls);
          const count = classItems.length;
          const totalConf = classItems.reduce((sum, p) => sum + p.confidence, 0);
          const avgConf = totalConf / count;
          
          responseContent += `• ${cls}: ${count} spots (avg ${(avgConf * 100).toFixed(0)}% confidence)\n`;
        });

        // Tampilkan gambar jika ada deteksi di atas threshold
        finalVisualizedImage = rawImage;

      } else {
        responseContent += `✅ Result: Healthy Forest\nNo deforestation indicators detected above 25% confidence.\n(Raw detections: ${rawPredictions.length}, all considered noise)`;
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
            content: `❌ Error analyzing image: ${error instanceof Error ? error.message : 'Unknown error'}.`,
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