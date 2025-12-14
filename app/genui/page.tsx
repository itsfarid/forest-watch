'use client';

import { useState, useRef } from 'react';
import { continueConversation, Message } from '@/app/actions';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconArrowUp } from '@/components/ui/icons';
import GenUICard from '@/components/cards/genuicard';

// Icon Paperclip sederhana untuk tombol upload
const IconPaperclip = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

export const maxDuration = 30;

export default function GenUI() {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  
  // State baru untuk Upload Image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. Logic Handle File (Upload & Drag-Drop) ---
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

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
  // -----------------------------------------------

  const handleSubmit = async () => {
    const contentToSend = selectedImage || input;
    if (!contentToSend.trim()) return;

    // Tentukan pesan user untuk UI (Optimistic Update)
    const newUserMessage: Message = {
      role: 'user',
      // Jika ada gambar, content sebenarnya adalah base64 string agar server paham
      // Tapi kita simpan text input pengguna sebagai 'caption' jika mau (opsional),
      // Di sini kita kirim base64 jika ada, atau text jika tidak.
      content: selectedImage || input, 
      // Kita manfaatkan properti visualizedImage untuk menampilkan preview upload user juga
      visualizedImage: selectedImage || undefined
    };

    // Reset Input UI
    setInput("");
    setSelectedImage(null);

    // Update state lokal dulu
    const newHistory = [...conversation, newUserMessage];
    setConversation(newHistory);

    // Panggil Server Action
    const { messages } = await continueConversation([
      // Map pesan agar sesuai struktur yang diminta server
      ...newHistory.map(({ role, content, visualizedImage }) => ({ 
        role, 
        content,
        visualizedImage 
      }))
    ]);
    
    setConversation(messages);
  } 

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }

  return (
    <div className="relative flex h-[calc(100vh_-_theme(spacing.16))] overflow-hidden pb-10 flex-col">
      <div className="group w-full overflow-auto">
        <div className="max-w-xl mx-auto mt-10 mb-32 px-4">
          
          {conversation.length <= 0 && (
            <GenUICard />
          )}

          {conversation.map((message, index) => (
            <div key={index} className="whitespace-pre-wrap flex mb-5">
              <div className={`${message.role === 'user' ? 'bg-slate-200 ml-auto' : 'bg-transparent w-full'} p-3 rounded-lg max-w-[85%]`}>
                
                {/* Tampilkan Text (Kecuali jika itu raw base64 image string yang panjang, kita sembunyikan textnya agar rapi) */}
                {(!message.content.startsWith('data:image') || message.role === 'assistant') && (
                  <div>
                    {message.content}
                  </div>
                )}
                
                {/* --- PERBAIKAN UTAMA: Render Gambar (Preview User atau Hasil AI) --- */}
                {message.visualizedImage && (
                  <div className="mt-2 rounded-md overflow-hidden border border-gray-300 bg-black/5">
                    <img 
                      src={message.visualizedImage.startsWith('data:') 
                        ? message.visualizedImage 
                        : `data:image/jpeg;base64,${message.visualizedImage}`
                      } 
                      alt="Result" 
                      className="w-full h-auto object-contain max-h-80" 
                    />
                  </div>
                )}

              </div>
            </div>
          ))}
        </div>

        {/* --- INPUT AREA & PREVIEW --- */}
        <div className="fixed inset-x-0 bottom-10 w-full z-10 px-4">
          <div className="w-full max-w-xl mx-auto">
            
            {/* Preview Image Sebelum Dikirim */}
            {selectedImage && (
              <div className="mb-2 relative w-fit animate-in fade-in slide-in-from-bottom-2">
                <div className="relative rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img src={selectedImage} alt="Preview" className="h-20 w-auto object-cover bg-white" />
                </div>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )}

            {/* Input Card dengan Drag & Drop */}
            <Card 
              className={`p-2 transition-colors duration-200 ${isDragging ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-2">
                
                {/* Tombol Upload */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-slate-500 hover:text-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Image"
                >
                  <IconPaperclip className="w-5 h-5" />
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileSelect}
                  />
                </Button>

                <Input
                  type="text"
                  value={input}
                  onKeyDown={handleKeyDown}
                  onChange={event => setInput(event.target.value)}
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 px-2"
                  placeholder={selectedImage ? "Describe this image..." : "Ask me anything or drop an image..."}
                  disabled={!!selectedImage} // Optional: disable text input jika gambar dipilih (atau biarkan enabled untuk caption)
                />
                
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() && !selectedImage}
                  className="shrink-0"
                >
                  <IconArrowUp />
                </Button> 
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}