'use client';

import { useState, useRef } from 'react';
import { continueConversation, Message } from '@/app/actions'; // Sesuaikan path import

export default function ForestChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State untuk Image Upload
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Handle File Selection (Klik tombol / Input hidden)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  // 2. Handle Drag & Drop Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // 3. Proses File menjadi Base64 untuk Preview & Pengiriman
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      // Hasil ini adalah string 'data:image/jpeg;base64,...'
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 4. Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    setIsLoading(true);

    // Prioritaskan gambar jika ada, jika tidak gunakan text input (URL)
    const contentToSend = selectedImage || input;
    
    // Tampilan pesan user di UI
    const newMessages: Message[] = [
      ...messages,
      { 
        role: 'user', 
        content: selectedImage ? 'Analyzing uploaded image...' : input,
        // Jika user upload gambar, tampilkan previewnya di chat bubble user juga
        display: selectedImage ? (
            <img src={selectedImage} alt="User upload" className="max-w-xs rounded-lg mt-2 border border-blue-200" />
        ) : undefined
      },
    ];

    setMessages(newMessages);
    setInput('');
    setSelectedImage(null); // Reset preview setelah kirim

    try {
      // Panggil Server Action
      const response = await continueConversation(newMessages);
      setMessages(response.messages);
    } catch (error) {
      console.error(error);
      alert('Failed to analyze image');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-w-2xl mx-auto border rounded-xl shadow-lg bg-white overflow-hidden">
      
      {/* Area Chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-3 rounded-lg max-w-[85%] whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-800 shadow-sm'
            }`}>
              {m.content}
            </div>
            {/* Render elemen display (Gambar Preview User atau Hasil Analisis AI) */}
            {m.display && <div className="mt-2">{m.display}</div>}
          </div>
        ))}
        {isLoading && <div className="text-gray-400 text-sm animate-pulse">Analyzing forest data...</div>}
      </div>

      {/* Area Input & Upload */}
      <div className="p-4 bg-white border-t">
        
        {/* Preview Image sebelum dikirim (Draft) */}
        {selectedImage && (
          <div className="relative mb-4 w-fit">
            <img src={selectedImage} alt="Preview" className="h-24 rounded border shadow-sm" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          
          {/* Tombol Upload & Drag Area */}
          <div 
            className={`relative flex items-center justify-center w-12 h-12 rounded-lg border-2 border-dashed cursor-pointer transition-colors
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            title="Click or Drop image here"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*" 
              className="hidden" 
            />
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
          </div>

          {/* Text Input (Optional jika user mau paste URL) */}
          <input
            className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={selectedImage ? "Ready to send image..." : "Paste image URL or drop file..."}
            disabled={!!selectedImage} // Disable text input jika sudah ada gambar
          />

          <button
            type="submit"
            disabled={isLoading || (!input && !selectedImage)}
            className="bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}