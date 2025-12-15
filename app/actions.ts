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
   Check AI Availability (exported because UI imports it)
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
   Roboflow settings (env)
   - ROBOFLOW_API_KEY
   - ROBOFLOW_MODEL_ID (e.g. students-eyecp/deforestation-detection-ivd96-instant-4)
   - optional: ROBOFLOW_INFERENCE_URL (full serverless/workflow inference URL)
   - optional: ROBOFLOW_DETECT_MODEL (detect.roboflow.com slug if different)
   - optional: ROBOFLOW_DEBUG=true to return raw preview to UI when no preds (temporary)
   ========================= */
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID;
const ROBOFLOW_INFERENCE_URL = process.env.ROBOFLOW_INFERENCE_URL;
const ROBOFLOW_DETECT_MODEL = process.env.ROBOFLOW_DETECT_MODEL || ROBOFLOW_MODEL_ID;
const ROBOFLOW_DEBUG = process.env.ROBOFLOW_DEBUG === 'true';

/* =========================
   Helpers
   ========================= */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function roboflowSafeCheck() {
  return Boolean(
    ROBOFLOW_API_KEY &&
      (ROBOFLOW_MODEL_ID || ROBOFLOW_INFERENCE_URL || ROBOFLOW_DETECT_MODEL)
  );
}

/**
 * Encode each segment of a path but preserve slashes.
 * Example: 'owner/project/model-version' => 'owner/project/model-version' with each segment URI-encoded.
 */
function safeModelPath(id: string) {
  return id
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function extractPredictionsFromResponse(rfResponse: any): any[] {
  if (!rfResponse) return [];
  if (Array.isArray(rfResponse.predictions)) return rfResponse.predictions;
  if (Array.isArray(rfResponse?.outputs?.[0]?.predictions)) return rfResponse.outputs[0].predictions;
  if (Array.isArray(rfResponse?.results?.[0]?.predictions)) return rfResponse.results[0].predictions;
  if (Array.isArray(rfResponse?.data?.predictions)) return rfResponse.data.predictions;
  // Some Roboflow Instant / workflows responses may nest predictions; attempt to find any array named predictions
  const findPreds = (obj: any): any[] | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj.predictions)) return obj.predictions;
    for (const k of Object.keys(obj)) {
      const val = obj[k];
      if (val && typeof val === 'object') {
        const nested = findPreds(val);
        if (nested) return nested;
      }
    }
    return null;
  };
  const nested = findPreds(rfResponse);
  return Array.isArray(nested) ? nested : [];
}

function annotatedImageFromResponse(rfResponse: any): string | null {
  return rfResponse?.image ?? rfResponse?.annotated ?? rfResponse?.output_image ?? rfResponse?.annotated_image ?? null;
}

/* =========================
   Convert dataURL -> Buffer & mime
   More tolerant regex to allow extra attributes before ;base64
   ========================= */
function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);.*base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL');
  const mime = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  return { buffer, mime };
}

/* =========================
   Analyze image with Roboflow
   - Priority order:
     1) ROBOFLOW_INFERENCE_URL (serverless workflow) -> JSON body { api_key, inputs }
     2) API JSON infer endpoint (api.roboflow.com/.../infer) -> JSON { image }
     3) detect.roboflow.com multipart/form-data fallback
   - Logs status for debugging
   ========================= */
async function analyzeImageWithRoboflow(base64DataUrl: string) {
  if (!roboflowSafeCheck()) {
    throw new Error('Roboflow environment variables not configured.');
  }

  // Mask helper for logging
  const maskKey = (k?: string) => (k ? `${k.slice(0, 8)}...` : '<<<no-key>>>');

  // 1) Try serverless / workflow inference if URL provided (preferred for workflows)
  if (ROBOFLOW_INFERENCE_URL) {
    try {
      console.log('[Roboflow] Attempting serverless workflow inference at:', ROBOFLOW_INFERENCE_URL);
      console.log('[Roboflow] api key preview:', maskKey(ROBOFLOW_API_KEY));

      const body = {
        api_key: ROBOFLOW_API_KEY,
        inputs: {
          image: {
            type: 'base64',
            value: base64DataUrl,
          },
        },
      };

      const resp = await fetch(ROBOFLOW_INFERENCE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch (e) {
        json = null;
      }

      console.log('[Roboflow] serverless attempt status:', resp.status, 'body-snippet:', text.slice(0, 2000));

      const preds = extractPredictionsFromResponse(json);
      if (Array.isArray(preds) && preds.length > 0) {
        if (ROBOFLOW_DEBUG) console.log('[Roboflow] serverless response preview:', JSON.stringify(json).slice(0, 4000));
        return json;
      }

      // If serverless returned an explicit error message (helpful for debugging), log it
      if (json && json.message) {
        console.log('[Roboflow] serverless message:', json.message);
      } else {
        console.log('[Roboflow] serverless returned no predictions, falling back to other endpoints.');
      }
    } catch (err) {
      console.error('[Roboflow] serverless attempt failed:', err);
      // continue to other attempts
    }
  } else {
    console.log('[Roboflow] No ROBOFLOW_INFERENCE_URL configured, skipping serverless workflow attempt.');
  }

  // 2) Try JSON dataURI POST to api.roboflow.com/<model>/infer if model id is present
  let jsonUrl = null;
  if (ROBOFLOW_MODEL_ID) {
    jsonUrl = `https://api.roboflow.com/${safeModelPath(ROBOFLOW_MODEL_ID)}/infer?api_key=${encodeURIComponent(ROBOFLOW_API_KEY!)}`;
  }

  if (jsonUrl) {
    try {
      console.log('[Roboflow] Attempting JSON infer at:', jsonUrl.replace(/(api_key=)[^&]+/, '$1<<<masked>>>'));
      const resp = await fetch(jsonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64DataUrl }),
      });

      const contentType = resp.headers.get('content-type') ?? '';
      let json: any = null;
      if (contentType.includes('application/json')) {
        try {
          json = await resp.json();
        } catch (e) {
          json = null;
        }
      } else {
        const txt = await resp.text();
        console.log('[Roboflow] JSON infer non-json response (status):', resp.status, 'body-snippet:', txt.slice(0, 2000));
      }

      console.log('[Roboflow] JSON attempt status:', resp.status, 'jsonKeys:', json ? Object.keys(json) : 'no-json');

      const preds = extractPredictionsFromResponse(json);
      if (Array.isArray(preds) && preds.length > 0) {
        if (ROBOFLOW_DEBUG) console.log('[Roboflow] JSON response preview:', JSON.stringify(json).slice(0, 4000));
        return json;
      }

      console.log('[Roboflow] JSON-response had no predictions, will try multipart fallback...');
    } catch (err) {
      console.error('[Roboflow] JSON attempt failed:', err);
    }
  } else {
    console.log('[Roboflow] No ROBOFLOW_MODEL_ID configured, skipping JSON infer attempt.');
  }

  // 3) Fallback: multipart/form-data to detect.roboflow.com/<MODEL_SLUG>
  const DETECT_MODEL = ROBOFLOW_DETECT_MODEL;
  if (!DETECT_MODEL) {
    throw new Error('Roboflow detect model not configured (ROBOFLOW_DETECT_MODEL or ROBOFLOW_MODEL_ID missing).');
  }

  try {
    const { buffer, mime } = dataUrlToBuffer(base64DataUrl);

    // Build FormData. Modern Node (18+) / undici exposes global FormData & Blob.
    const form = new FormData();
    try {
      // Try Blob first (web-compatible)
      // @ts-ignore
      const blob = typeof Blob !== 'undefined' ? new Blob([buffer], { type: mime }) : null;
      if (blob) {
        // @ts-ignore
        form.append('file', blob, 'upload.jpg');
      } else {
        // fallback: append buffer (some runtimes accept Buffer in FormData append)
        // @ts-ignore
        form.append('file', buffer, { filename: 'upload.jpg', contentType: mime });
      }
    } catch (e) {
      // fallback: append Buffer with options (some runtimes accept it)
      // @ts-ignore
      form.append('file', buffer, { filename: 'upload.jpg', contentType: mime });
    }

    const detectUrl = `https://detect.roboflow.com/${safeModelPath(DETECT_MODEL)}?api_key=${encodeURIComponent(ROBOFLOW_API_KEY!)}`;
    console.log('[Roboflow] multipart detectUrl:', detectUrl.replace(/(api_key=)[^&]+/, '$1<<<masked>>>'));

    const r2 = await fetch(detectUrl, {
      method: 'POST',
      body: form as any,
      // DO NOT set Content-Type, boundary will be set automatically
    });

    const ct2 = r2.headers.get('content-type') ?? '';
    let json2: any = null;
    if (ct2.includes('application/json')) {
      try {
        json2 = await r2.json();
      } catch (e) {
        console.error('[Roboflow] multipart returned invalid json:', e);
      }
    } else {
      const text = await r2.text();
      console.log('[Roboflow] multipart non-json response (status):', r2.status, 'body-snippet:', text.slice(0, 2000));
    }

    console.log('[Roboflow] multipart attempt status:', r2.status, 'jsonKeys:', json2 ? Object.keys(json2) : 'no-json');

    if (ROBOFLOW_DEBUG && json2) {
      console.log('[Roboflow] multipart response preview:', JSON.stringify(json2).slice(0, 4000));
    }

    return json2;
  } catch (err) {
    console.error('[Roboflow] multipart fallback failed:', err);
    throw err;
  }
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

      // Robust extraction of predictions
      const predictions: Array<{ confidence?: number; class?: string }> = extractPredictionsFromResponse(rfResponse);

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

      const annotatedImageUrl = annotatedImageFromResponse(rfResponse);

      // If no predictions and debug enabled, return preview to UI for troubleshooting
      if ((!predictions || predictions.length === 0) && ROBOFLOW_DEBUG) {
        const raw = typeof rfResponse === 'string' ? rfResponse : JSON.stringify(rfResponse, null, 2);
        const assistantMessage: Message = {
          role: 'assistant',
          content: `🔎 Roboflow response (debug):\n\n${raw.slice(0, 3000)}\n\n(End preview)`,
        };
        return { messages: [...messages, assistantMessage] };
      }

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