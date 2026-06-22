import sharp from "sharp";
import { fallbackAiModel, getConfiguredAiModel, getConfiguredVisionModel } from "./ai-model-settings";

export interface AiContentBlock {
  type: "text" | "image";
  text?: string;
  imageBase64?: string;
  mediaType?: string;
}

export interface AiCallOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface VisionDiagnostics {
  model: string;
  provider: "reverseproxy" | "gateway";
  imageBlockCount: number;
  mediaTypes: string[];
  requestMode: "text-only" | "multimodal";
  latencyMs: number;
}

export interface AiCallResult {
  text: string;
  provider: "reverseproxy" | "gateway";
  diagnostics?: VisionDiagnostics;
}

function reverseproxyEnabled(): boolean {
  return (process.env.REVERSEPROXY_ENABLED || "").toLowerCase() === "true";
}

function reverseproxyUrl(): string {
  return (process.env.REVERSEPROXY_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
}

function reverseproxyModel(): string {
  return process.env.REVERSEPROXY_MODEL || "chatgpt-anon";
}

export function gatewayBaseUrl(): string {
  // Prefer LLM_GATEWAY_BASE_URL (the canonical public endpoint) so a stale
  // SPARE_PART_AI_GATEWAY_URL injected by the PM2 daemon can't override the
  // value loaded from .env at runtime.
  return (
    process.env.LLM_GATEWAY_BASE_URL ||
    process.env.SPARE_PART_AI_GATEWAY_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

export function gatewayModel(): string {
  return fallbackAiModel();
}

export async function currentGatewayModel(): Promise<string> {
  return getConfiguredAiModel();
}

const VISION_FALLBACK_MODEL = "umans/umans-kimi-k2.7";

export function visionModel(): string {
  return process.env.SPARE_PART_AI_VISION_MODEL || "";
}

export async function currentVisionModel(): Promise<string> {
  // 1. DB-configured vision model (AI settings page) or env override
  const configured = await getConfiguredVisionModel();
  if (configured) return configured;

  // 2. Try the configured gateway model — but only if provider-prefixed
  //    (bare model names like "mimo-v2.5-pro" won't work for vision)
  try {
    const gw = await currentGatewayModel();
    if (gw && gw.includes("/")) return gw;
  } catch {
    // DB might not be reachable at startup — fall through
  }

  // 3. Hard vision fallback — never a bare model name
  return VISION_FALLBACK_MODEL;
}

export function gatewayKey(): string {
  const key = process.env.SPARE_PART_AI_GATEWAY_KEY || process.env.LLM_GATEWAY_API_KEY || "";
  if (!key) {
    console.error(
      "CRITICAL: No AI gateway key configured. Set SPARE_PART_AI_GATEWAY_KEY or LLM_GATEWAY_API_KEY in environment.",
    );
  }
  return key;
}

export function extractTextFromAnthropic(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

export function parseJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("AI did not return a JSON object");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      return JSON.parse(raw.slice(start, i + 1)) as unknown;
    }
  }

  throw new Error("AI returned incomplete JSON");
}

export async function imageBlockForAi(buffer: Buffer): Promise<AiContentBlock> {
  const normalized = await sharp(buffer)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();

  return {
    type: "image",
    imageBase64: normalized.toString("base64"),
    mediaType: "image/jpeg",
  };
}

function toReverseproxyMessages(content: AiContentBlock[]): Array<{ role: string; content: unknown }> {
  const parts: unknown[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "image" && block.imageBase64) {
      const mediaType = block.mediaType || "image/jpeg";
      parts.push({
        type: "image_url",
        image_url: { url: `data:${mediaType};base64,${block.imageBase64}` },
      });
    }
  }
  return [{ role: "user", content: parts }];
}


async function callReverseproxy(content: AiContentBlock[], opts: AiCallOptions, modelOverride?: string): Promise<{ text: string; diagnostics: VisionDiagnostics }> {
  const model = modelOverride || reverseproxyModel();
  const imageBlocks = content.filter((b) => b.type === "image" && b.imageBase64);
  const requestMode = imageBlocks.length > 0 ? "multimodal" : "text-only";
  const start = Date.now();

  const response = await fetch(`${reverseproxyUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    body: JSON.stringify({
      model,
      stream: true,
      messages: toReverseproxyMessages(content),
    }),
  });

  if (!response.ok) {
    throw new Error(`reverseproxy returned ${response.status}`);
  }
  if (!response.body) {
    throw new Error("reverseproxy returned no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = event.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          error?: { message?: string };
          choices?: Array<{ delta?: { content?: string } }>;
        };
        if (parsed.error) {
          throw new Error(`reverseproxy error: ${parsed.error.message ?? "unknown"}`);
        }
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) text += delta;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("reverseproxy error:")) throw err;
      }
    }
  }

  if (!text) {
    throw new Error("reverseproxy returned empty content");
  }
  return {
    text,
    diagnostics: {
      model,
      provider: "reverseproxy",
      imageBlockCount: imageBlocks.length,
      mediaTypes: [...new Set(imageBlocks.map((b) => b.mediaType || "image/jpeg"))],
      requestMode,
      latencyMs: Date.now() - start,
    },
  };
}

function extractTextFromOpenAI(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  // Check for error payload before extracting text
  const err = (payload as { error?: { type?: string; message?: string } }).error;
  if (err) {
    throw new Error(
      `gateway error: ${err.type || "unknown"}: ${err.message || "No error message"}`,
    );
  }
  const outputText = (payload as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return extractTextContent(content);
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
      const contentText = (part as { content?: unknown }).content;
      if (typeof contentText === "string") return contentText;
      return "";
    })
    .join("\n")
    .trim();
}

export function extractTextFromOpenAIStream(raw: string): string {
  let text = "";
  let streamError: { type: string; message: string } | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    let parsed: {
      error?: { type?: string; message?: string };
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
    };
    try {
      parsed = JSON.parse(data);
    } catch {
      // Malformed event chunk — skip and keep reading
      continue;
    }

    // Check for SSE error frames FIRST — never ignore them
    if (parsed.error) {
      streamError = {
        type: parsed.error.type || "unknown",
        message: parsed.error.message || "No error message",
      };
      // Don't break immediately — collect any content already streamed,
      // but the error will be thrown after the loop
      continue;
    }

    // Only accumulate delta.content (NOT reasoning_content)
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) text += delta.content;
  }

  if (streamError) {
    throw new Error(
      `gateway stream error: ${streamError.type}: ${streamError.message}`,
    );
  }

  return text.trim();
}

async function callGateway(content: AiContentBlock[], opts: AiCallOptions, modelOverride?: string): Promise<{ text: string; diagnostics: VisionDiagnostics }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const apiKey = gatewayKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const imageBlocks = content.filter((b) => b.type === "image" && b.imageBase64);
  const requestMode = imageBlocks.length > 0 ? "multimodal" : "text-only";
  const start = Date.now();
  const model = modelOverride || await currentGatewayModel();

  const parts: unknown[] = [];
  const textOnly: string[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push({ type: "text", text: block.text });
      textOnly.push(block.text);
      continue;
    }
    if (block.type !== "image" || !block.imageBase64) continue;
    const mediaType = block.mediaType || "image/jpeg";
    parts.push({
      type: "image_url",
      image_url: { url: `data:${mediaType};base64,${block.imageBase64}` },
    });
  }

  const messages = [
    {
      role: "user",
      content:
        parts.some((part) => {
          return (
            typeof part === "object" &&
            part !== null &&
            (part as { type?: unknown }).type === "image_url"
          );
        })
          ? parts
          : textOnly.join("\n\n"),
    },
  ];

  const response = await fetch(`${gatewayBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`gateway returned ${response.status}`);
  }
  const raw = await response.text();
  const latencyMs = Date.now() - start;
  const diagnostics: VisionDiagnostics = {
    model,
    provider: "gateway",
    imageBlockCount: imageBlocks.length,
    mediaTypes: [...new Set(imageBlocks.map((b) => b.mediaType || "image/jpeg"))],
    requestMode,
    latencyMs,
  };

  if (raw.trim().startsWith("data:")) {
    return { text: extractTextFromOpenAIStream(raw), diagnostics };
  }
  return { text: extractTextFromOpenAI(JSON.parse(raw)), diagnostics };
}

export async function callPartAi(
  content: AiContentBlock[],
  opts: AiCallOptions = {},
  modelOverride?: string,
): Promise<AiCallResult> {
  if (reverseproxyEnabled()) {
    try {
      const result = await callReverseproxy(content, opts, modelOverride);
      return { text: result.text, provider: "reverseproxy", diagnostics: result.diagnostics };
    } catch (err) {
      console.warn(
        `reverseproxy failed (${(err as Error).message}), falling back to gateway`,
      );
    }
  }
  const result = await callGateway(content, opts, modelOverride);
  return { text: result.text, provider: "gateway", diagnostics: result.diagnostics };
}
