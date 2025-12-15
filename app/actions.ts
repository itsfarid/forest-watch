"use server";

export interface Message {
  role: "user" | "assistant";
  content: string;
  display?: React.ReactNode;
  imageUrl?: string;
}

interface RoboflowResponse {
  predictions: Array<{
    class: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

export async function analyzeForestImage(imageUrl: string) {
  const apiKey = process.env.ROBOFLOW_API_KEY;

  if (!apiKey) {
    throw new Error("ROBOFLOW_API_KEY not configured");
  }

  try {
    console.log("Calling Roboflow Direct Model API...");

    const isBase64 = imageUrl.startsWith("data:image");

    let apiUrl: string;
    let requestBody: string | null;
    let headers: Record<string, string>;

    if (isBase64) {
      // Base64 upload
      apiUrl = `https://detect.roboflow.com/deforestation-detection-ivd96/4?api_key=${apiKey}&confidence=95`;
      requestBody = imageUrl.split(",")[1];
      headers = { "Content-Type": "application/x-www-form-urlencoded" };
    } else {
      // URL-based inference
      apiUrl = `https://detect.roboflow.com/deforestation-detection-ivd96/4?api_key=${apiKey}&confidence=95&image=${encodeURIComponent(
        imageUrl
      )}`;
      requestBody = null;
      headers = { "Content-Type": "application/json" };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: requestBody,
    });

    const responseText = await response.text();
    console.log("API Response Status:", response.status);

    if (!response.ok) {
      throw new Error(
        `Roboflow API error (${response.status}): ${responseText}`
      );
    }

    const result: RoboflowResponse = JSON.parse(responseText);
    console.log("Predictions count:", result.predictions?.length || 0);

    return result;
  } catch (error) {
    console.error("Error calling Roboflow:", error);
    throw error;
  }
}

export async function continueConversation(messages: Message[]) {
  const lastMessage = messages[messages.length - 1];

  const isBase64Image = lastMessage.content.startsWith("data:image");
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = lastMessage.content.match(urlPattern);

  const imageUrl = isBase64Image
    ? lastMessage.content
    : urls && urls.length > 0
    ? urls[0]
    : null;

  if (imageUrl) {
    const isImageUrl =
      isBase64Image ||
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(imageUrl) ||
      imageUrl.includes("unsplash.com") ||
      imageUrl.includes("images") ||
      imageUrl.includes("photo") ||
      imageUrl.includes("imgs.") ||
      imageUrl.includes("upload") ||
      imageUrl.includes("mongabay");

    if (isImageUrl) {
      try {
        const result = await analyzeForestImage(imageUrl);

        const predictions = Array.isArray(result.predictions)
          ? result.predictions
          : [];
        const detectionCount = predictions.length;

        console.log("Final detection count:", detectionCount);

        let responseContent = `🌲 Forest Analysis Results:\n\n`;

        if (detectionCount === 0) {
          responseContent += `✅ Deforestation Status: NOT DETECTED\n\n`;
          responseContent += `The analyzed area appears to be healthy forest with no deforestation indicators.`;
        } else if (detectionCount < 50) {
          responseContent += `⚠️ Deforestation Status: MINIMAL\n\n`;
          responseContent += `📊 Affected areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Forest coverage: High (~${(
            100 -
            (detectionCount / 200) * 100
          ).toFixed(1)}%)\n\n`;
          responseContent += `💡 Assessment: The area is predominantly healthy forest with minor disturbances detected.`;
        } else if (detectionCount < 80) {
          responseContent += `🔶 Deforestation Status: MODERATE\n\n`;
          responseContent += `📊 Affected areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation coverage: ~${Math.min(
            (detectionCount / 200) * 100,
            100
          ).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Moderate deforestation detected with scattered cleared patches throughout the area.`;
        } else {
          responseContent += `🔴 Deforestation Status: SEVERE\n\n`;
          responseContent += `📊 Affected areas detected: ${detectionCount} locations\n`;
          responseContent += `📈 Estimated deforestation coverage: ~${Math.min(
            (detectionCount / 200) * 100,
            100
          ).toFixed(1)}%\n\n`;
          responseContent += `💡 Assessment: Severe deforestation detected with major habitat loss and environmental impact.`;
        }

        return {
          messages: [
            ...messages,
            {
              role: "assistant" as const,
              content: responseContent,
              imageUrl: imageUrl,
            },
          ],
        };
      } catch (error) {
        console.error("Full error:", error);
        return {
          messages: [
            ...messages,
            {
              role: "assistant" as const,
              content: `❌ Error analyzing image: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  }

  return {
    messages: [
      ...messages,
      {
        role: "assistant" as const,
        content: `🌲 Forest Watch AI\n\nUpload an image or paste URL to analyze for deforestation detection.\n\nI'll check if there are any deforestation indicators in the image.`,
      },
    ],
  };
}

export async function checkAIAvailability() {
  const hasApiKey = !!process.env.ROBOFLOW_API_KEY;

  return {
    available: hasApiKey,
    message: hasApiKey
      ? "🌲 Forest detection AI is ready"
      : "⚠️ Please configure ROBOFLOW_API_KEY in environment variables",
  };
}
