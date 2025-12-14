'use server';

/* ... (Kode interface dan analyzeForestImage sama seperti sebelumnya) ... */

// Interface Message kamu
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: React.ReactNode; // Kita akan pakai ini untuk menampilkan gambar hasil
}

// ... (Simpan bagian analyzeForestImage seperti aslinya) ...

export async function continueConversation(messages: Message[]) {
  const lastMessage = messages[messages.length - 1];
  
  // Logic untuk mengecek apakah pesan berisi Base64 Image atau URL
  const isBase64 = lastMessage.content.startsWith('data:image/');
  
  // Regex sederhana untuk URL
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = lastMessage.content.match(urlPattern);
  const imageUrl = isBase64 ? lastMessage.content : (urls ? urls[0] : null);

  // Jika ada gambar (baik base64 atau URL)
  if (imageUrl) {
    try {
      // 1. Panggil Roboflow
      const result = await analyzeForestImage(imageUrl);
      
      const outputs = result.outputs || [];
      const detectionCount = outputs.find(o => o.count_objects !== undefined)?.count_objects || 0;
      const predictions = outputs.find(o => o.predictions)?.predictions || [];
      
      // Ambil gambar hasil visualisasi (biasanya base64 tanpa prefix)
      const visualizedImageRaw = outputs.find(o => o.output_image)?.output_image?.value;
      
      // Format hasil teks
      let responseContent = `🌲 Forest Analysis Results:\n\n`;
      responseContent += `📊 Objects detected: ${detectionCount}\n\n`;
      
      if (predictions.length > 0) {
        // ... (Logika text predictions sama seperti kodemu) ...
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

      // 2. Siapkan komponen tampilan (Display) untuk Gambar Hasil
      let displayComponent = null;

      if (visualizedImageRaw) {
        // Pastikan formatnya data URI yang benar
        const resultImageSrc = visualizedImageRaw.startsWith('data:') 
          ? visualizedImageRaw 
          : `data:image/jpeg;base64,${visualizedImageRaw}`;

        // Kita kirim element gambar sebagai display
        // Catatan: Karena ini Server Action, kita kembalikan struktur data yang nanti dirender client
        // atau string HTML simple jika menggunakan dangerouslySetInnerHTML, 
        // tapi cara paling aman di Next.js 'use server' dengan interface ReactNode adalah seperti ini:
        displayComponent = (
           <div className="mt-4 rounded-lg overflow-hidden border border-gray-200">
             <p className="text-sm text-gray-500 mb-2 p-2 bg-gray-50">Visualized Result:</p>
             <img src={resultImageSrc} alt="Analysis Result" className="w-full h-auto" />
           </div>
        );
      }

      if (detectionCount === 0) {
        responseContent = `🌲 Forest Analysis Results:\n\n✅ No deforestation indicators detected. Healthy forest area.`;
      }
      
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: responseContent,
            display: displayComponent, // Sertakan gambar hasil di sini
          },
        ],
      };

    } catch (error) {
      console.error('Error:', error);
      return {
        messages: [
          ...messages,
          {
            role: 'assistant' as const,
            content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
  
  // Default response jika tidak ada gambar
  return {
    messages: [
      ...messages,
      {
        role: 'assistant' as const,
        content: `🌲 Forest Watch AI Ready.\nUpload an image or send a URL.`,
      },
    ],
  };
}

// ... (checkAIAvailability tetap sama)