'use server';

import OpenAI from 'openai';

/* =========================
   Types
   ========================= */
export type Message = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
};

/* =========================
   OpenAI Client (dipakai sebagai fallback untuk text chat)
   ========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   Check AI Availability (exported again because UI imports it)
   ========================= */
export async function checkAIAvailability(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    await openai.models.list();
    return {
      available: true,
      message: 'AI service is online',
    };
  } catch (error) {
    console.error('AI availability check failed:', error);
    return {
      available: false,
      message: 'AI service is unavailable',
    };
  }
}

/* =========================
   Roboflow settings (set di env)
   - ROBOFLOW_API_KEY: kunci API Roboflow
   - ROBOFLOW_MODEL_ID: model id / model path seperti "students-eyecp/deforestation-detection-ivd96-instant-4"
   - (optional) ROBOFLOW_INFERENCE_URL: full inference endpoint jika ingin override
   ========================= */
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID;
const ROBOFLOW_INFERENCE_URL = process.env.ROBOFLOW_INFERENCE_URL;

/* =========================
   Helper utilities
   ========================= */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function roboflowSafeCheck() {
  return Boolean(ROBOFLOW_API_KEY && (ROBOFLOW_MODEL_ID || ROBOFLOW_INFERENCE_URL));
}

/* =========================
   Analyze image with Roboflow
   ========================= */
async function analyzeImageWithRoboflow(base64DataUrl: string) {
  if (!roboflowSafeCheck()) {
    throw new Error('Roboflow environment variables not configured.');
  }

  // use non-null assertion because we already checked presence above
  const baseUrl = ROBOFLOW_INFERENCE_URL
    ? ROBOFLOW_INFERENCE_URL
    : `https://api.roboflow.com/${encodeURIComponent(ROBOFLOW_MODEL_ID!)} /infer?api_key=${encodeURIComponent(ROBOFLOW_API_KEY!)}`.replace(
        ' /infer',
        '/infer'
      );

  // Roboflow Instant / most infer endpoints accept JSON { image: "<dataURI or url>" }
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: base64DataUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(`Roboflow inference failed ${res.status} ${res.statusText}: ${text}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  const json = await res.json();
  return json;
}

/* =========================
   Continue Conversation
   - If last user message is a data:image... base64, call Roboflow and return structured assistant message
   - Otherwise, fallback to OpenAI chat completion
   ========================= */
export async function continueConversation(
  messages: Message[]
): Promise<{ messages: Message[] }> {
  if (!messages || messages.length === 0) {
    return { messages };
  }

  const last = messages[messages.length - 1];

  // Handle base64 image data
  if (last.role === 'user' && typeof last.content === 'string' && last.content.startsWith('data:image')) {
    try {
      const rfResponse = await analyzeImageWithRoboflow(last.content);

      const predictions: Array<{ confidence?: number; class?: string }> = Array.isArray(rfResponse.predictions)
        ? rfResponse.predictions
        : [];

      const total = predictions.length;
      const avgConf = total > 0 ? predictions.reduce((s, p) => s + (p.confidence ?? 0), 0) / total : 0;

      const top = predictions
        .slice()
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 5)
        .map((p) => ({
          class: p.class ?? 'unknown',
          confidence: (p.confidence ?? 0) * 100,
        }));

      // Roboflow may return an annotated image URL under different keys
      const annotatedImageUrl = rfResponse.image ?? rfResponse.annotated ?? rfResponse.output_image ?? null;

      const assistantContentLines: string[] = [
        `✅ Image analyzed with Roboflow model (${ROBOFLOW_MODEL_ID ?? 'roboflow model'}).`,
        `Detections: ${total}`,
        `Average confidence: ${Math.round(avgConf * 10000) / 100} %`,
        '',
      ];

      if (top.length > 0) {
        assistantContentLines.push('Top detections:');
        top.forEach((t, i) => {
          assistantContentLines.push(`${i + 1}. ${t.class} — ${t.confidence.toFixed(1)}%`);
        });
      } else {
        assistantContentLines.push('No objects detected above threshold.');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContentLines.join('\n'),
      };

      if (annotatedImageUrl) assistantMessage.imageUrl = annotatedImageUrl;

      return {
        messages: [...messages, assistantMessage],
      };
    } catch (err: any) {
      console.error('Roboflow analysis failed:', err);

      return {
        messages: [
          ...messages,
          {
            role: 'assistant',
            content:
              '❌ Image analysis with Roboflow failed. Please check your Roboflow API key, model id, and that the inference endpoint is reachable. ' +
              (err?.message ? `Error: ${err.message}` : ''),
          },
        ],
      };
    }
  }

  // Fallback: OpenAI chat completion for text
  try {
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: formattedMessages,
      temperature: 0.3,
    });

    const assistantMessage: Message = {
      role: 'assistant',
      content: response.choices[0]?.message?.content ?? '⚠️ No response generated.',
    };

    return {
      messages: [...messages, assistantMessage],
    };
  } catch (error) {
    console.error('continueConversation fallback error:', error);

    return {
      messages: [
        ...messages,
        {
          role: 'assistant',
          content:
            '❌ Failed to process request. Please check API key(s) and server logs, or try again later.',
        },
      ],
    };
  }
}