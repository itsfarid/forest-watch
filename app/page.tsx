"use client";

import { useState, useRef, useEffect } from "react";
import { continueConversation, Message } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IconArrowUp } from "@/components/ui/icons";
import { IMAGE_COMPRESSION } from "@/lib/config/constants";
import { BoundingBoxOverlay } from "@/components/BoundingBoxOverlay";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

const CONFIDENCE_DEFAULT = 0.5;
const CONFIDENCE_STORAGE_KEY = "fw_confidence_threshold";

const IconPaperclip = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const IconTree = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 10a6 6 0 0 0-6 6h12a6 6 0 0 0-6-6Z" />
    <path d="M12 2a8 8 0 0 0-8 8v12h16V10a8 8 0 0 0-8-8Z" />
    <path d="M12 14v8" />
  </svg>
);

export const maxDuration = 60;

export default function Home() {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<
    "idle" | "compressing" | "analyzing" | "done"
  >("idle");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(() => {
    if (typeof window === "undefined") return CONFIDENCE_DEFAULT;
    const stored = localStorage.getItem(CONFIDENCE_STORAGE_KEY);
    const parsed = stored ? parseFloat(stored) : NaN;
    return isNaN(parsed) ? CONFIDENCE_DEFAULT : parsed;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist threshold preference to localStorage
  useEffect(() => {
    localStorage.setItem(
      CONFIDENCE_STORAGE_KEY,
      confidenceThreshold.toString(),
    );
  }, [confidenceThreshold]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");

          // Only resize if image exceeds max dimensions -- never upscale smaller images
          const scaleRatio = Math.min(
            IMAGE_COMPRESSION.MAX_WIDTH / img.width,
            IMAGE_COMPRESSION.MAX_HEIGHT / img.height,
            1, // clamp to 1 so images smaller than max are not upscaled
          );
          const width = Math.round(img.width * scaleRatio);
          const height = Math.round(img.height * scaleRatio);

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL(
            "image/jpeg",
            IMAGE_COMPRESSION.QUALITY,
          );
          resolve(compressedBase64);
        };
      };
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, GIF, or WebP)");
      return;
    }
    try {
      const compressedData = await compressImage(file);
      setSelectedImage(compressedData);
    } catch (e) {
      logger.error("Failed to process image", {
        error: e instanceof Error ? e.message : String(e),
      });
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
    setLoadingStage(selectedImage ? "compressing" : "analyzing");

    const newUserMessage: Message = {
      role: "user",
      content: selectedImage || input,
    };

    setInput("");
    setSelectedImage(null);

    const newHistory = [...conversation, newUserMessage];
    setConversation(newHistory);

    try {
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        setIsLoading(false);
        setLoadingStage("idle");
        setConversation([
          ...newHistory,
          {
            role: "assistant",
            content: "❌ Permintaan memakan waktu terlalu lama. Coba lagi.",
          },
        ]);
      }, IMAGE_COMPRESSION.SUBMIT_TIMEOUT_MS);

      setLoadingStage("analyzing");
      const { messages } = await continueConversation(
        newHistory,
        confidenceThreshold,
      );
      clearTimeout(timeoutId);

      if (!timedOut) {
        setLoadingStage("done");
        setConversation(messages);
      }
    } catch (error) {
      logger.error("Error submitting", {
        error: error instanceof Error ? error.message : String(error),
      });
      const userMessage =
        error instanceof Error && "userMessage" in error
          ? (error as { userMessage: string }).userMessage
          : "Terjadi kesalahan. Periksa koneksi internet Anda dan coba lagi.";
      setConversation([
        ...newHistory,
        { role: "assistant", content: `❌ ${userMessage}` },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingStage("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
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
                <IconTree className="w-12 h-12" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">
                Forest Watch AI
              </h1>
              <p className="text-gray-500 max-w-sm">
                Upload citra satelit atau aerial untuk mendeteksi potensi
                deforestasi secara otomatis menggunakan computer vision.
              </p>
              <div className="flex flex-col gap-2 text-sm text-gray-400 max-w-xs">
                <span>📎 Upload file gambar (JPG, PNG)</span>
                <span>🔗 Paste URL gambar</span>
                <span>🖱️ Drag & drop ke kolom input</span>
              </div>
              <a
                href="/about"
                className="text-sm text-green-700 hover:underline font-medium"
              >
                Pelajari lebih lanjut →
              </a>
            </div>
          )}

          {conversation.map((message, index) => (
            <div key={index} className="whitespace-pre-wrap flex mb-5">
              <div
                className={`${message.role === "user" ? "bg-slate-200 ml-auto" : "bg-transparent w-full"} p-3 rounded-lg max-w-[85%]`}
              >
                {message.role === "assistant" && (
                  <>
                    {message.imageUrl && (
                      <div className="mb-3 rounded-md overflow-hidden border border-gray-300">
                        {message.predictions &&
                        message.predictions.length > 0 ? (
                          <BoundingBoxOverlay
                            imageUrl={message.imageUrl}
                            predictions={message.predictions}
                            alt={`Hasil analisis citra dengan ${message.predictions.length} area terdeteksi`}
                          />
                        ) : (
                          <img
                            src={message.imageUrl}
                            alt="Citra satelit hasil analisis deforestasi"
                            className="w-full h-auto object-contain max-h-60"
                          />
                        )}
                      </div>
                    )}
                    <div>{message.content}</div>
                  </>
                )}

                {message.role === "user" &&
                  !message.content.startsWith("data:image") && (
                    <div>{message.content}</div>
                  )}

                {message.role === "user" &&
                  message.content.startsWith("data:image") && (
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
                {loadingStage === "compressing" && "🗜️ Mengompresi gambar..."}
                {loadingStage === "analyzing" &&
                  "🤖 Menganalisis potensi deforestasi..."}
                {loadingStage === "done" && "✅ Selesai"}
                {loadingStage === "idle" && "⏳ Memproses..."}
              </div>
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-10 w-full z-10 px-4">
          <div className="w-full max-w-xl mx-auto">
            {/* Confidence threshold slider — only shown when an image is selected */}
            {selectedImage && (
              <div className="mb-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">
                    Sensitivitas deteksi
                  </label>
                  <span className="text-xs font-semibold text-green-700">
                    {Math.round(confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={confidenceThreshold}
                  onChange={(e) =>
                    setConfidenceThreshold(parseFloat(e.target.value))
                  }
                  className="w-full h-1.5 accent-green-600 cursor-pointer"
                  aria-label="Confidence threshold"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Rendah = lebih banyak area terdeteksi · Tinggi = lebih presisi
                </p>
              </div>
            )}
            {selectedImage && (
              <div className="mb-2 relative w-fit animate-in fade-in slide-in-from-bottom-2">
                <div className="relative rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src={selectedImage}
                    alt="Preview citra yang akan dianalisis"
                    className="h-20 w-auto object-cover bg-white"
                  />
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-sm transition-colors"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            <Card
              className={`p-2 transition-colors duration-200 ${isDragging ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              tabIndex={0}
              role="button"
              aria-label="Upload image or drag and drop a file here"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
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
                  onChange={(event) => setInput(event.target.value)}
                  className="flex-1 border-0 shadow-none focus-visible:ring-0 px-2"
                  placeholder={
                    selectedImage
                      ? "Image selected, click send to analyze..."
                      : "Paste image URL or upload..."
                  }
                  disabled={isLoading || !!selectedImage}
                />

                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="shrink-0"
                >
                  {isLoading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent" />
                  ) : (
                    <IconArrowUp />
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
