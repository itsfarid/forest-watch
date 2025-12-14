'use client';

import { useState, useRef } from 'react';
import { continueConversation, Message } from '@/app/actions';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconArrowUp } from '@/components/ui/icons';

const IconPaperclip = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const IconTree = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 10a6 6 0 0 0-6 6h12a6 6 0 0 0-6-6Z"/><path d="M12 2a8 8 0 0 0-8 8v12h16V10a8 8 0 0 0-8-8Z"/><path d="M12 14v8"/>
  </svg>
);

export const maxDuration = 60;

export default function Home() {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          const width = MAX_WIDTH;
          const height = img.height * scaleSize;

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
      };
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    try {
      const compressedData = await compressImage(file);
      setSelectedImage(compressedData);
    } catch (e) {
      console.error("Failed to process image", e);
    }
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

  const handleSubmit = async () => {
    const contentToSend = selectedImage || input;
    if (!contentToSend.trim()) return;

    setIsLoading(true);

    const newUserMessage: Message = {
      role: 'user',
      content: selectedImage || input
    };

    setInput("");
    setSelectedImage(null);

    const newHistory = [...conversation, newUserMessage];
    setConversation(newHistory);

    try {
      const { messages } = await continueConversation(newHistory);
      setConversation(messages);
    } catch (error) {
      console.error("Error submitting:", error);
      setConversation([
        ...newHistory,
        { role: 'assistant', content: "❌ Failed to analyze image. Please check API Key or try another image." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="relative flex h-[calc(100vh_-_theme(spacing.16))] overflow-hidden pb-10 flex-col">
      <div className="group w-full overflow-auto">
        <div className="max-w-xl mx-auto mt-10 mb-32 px-4">
          
          {conversation.length <= 0 && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
              <div className="p-4 bg-green-100 rounded-full text-green-600">
                <IconTree className="w-12 h-12" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">🌲 Forest Watch AI</h1>
              <p className="text-gray-500 max-w-sm">
                Upload forest photos or satellite imagery to automatically detect potential deforestation.
              </p>
            </div>
          )}

          {conversation.map((message, index) => (
            <div key={index} className="whitespace-pre-wrap flex mb-5">
              <div className={`${message.role === 'user' ? 'bg-slate-200 ml-auto' : 'bg-transparent w-full'} p-3 rounded-lg max-w-[85%]`}>
                
                {message.role === 'assistant' && (
                  <div>{message.content}</div>
                )}
                
                {message.role === 'user' && !message.content.startsWith('data:image') && (
                  <div>{message.content}</div>
                )}
                
                {message.role === 'user' && message.content.startsWith('data:image') && (
                  <div className="rounded-md overflow-hidden border border-gray-300">
                    <img 
                      src={message.content} 
                      alt="Uploaded" 
                      className="w-full h-auto object-contain max-h-60" 
                    />
                  </div>
                )}

              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex mb-5">
               <div className="bg-transparent w-full p-3 text-gray-500 italic animate-pulse">
                 🤖 Analyzing forest data...
               </div>
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-10 w-full z-10 px-4">
          <div className="w-full max-w-xl mx-auto">
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

            <Card 
              className={`p-2 transition-colors duration-200 ${isDragging ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-slate-500 hover:text-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Image"
                >
                  <IconPaperclip className="w-5 h-5" />
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect}/>
                </Button>

                <Input
                  type="text"
                  value={input}
                  onKeyDown={handleKeyDown}
                  onChange={event => setInput(event.target.value)}
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 px-2"
                  placeholder={selectedImage ? "Image selected, click send to analyze..." : "Paste image URL or upload..."}
                  disabled={isLoading || !!selectedImage}
                />
                
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="shrink-0"
                >
                  {isLoading ? <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" /> : <IconArrowUp />}
                </Button> 
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}