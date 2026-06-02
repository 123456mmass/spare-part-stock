import sharp from "sharp";

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

export interface AiCallResult {
  text: string;
  provider: "reverseproxy" | "gateway";
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
  return (
    process.env.SPARE_PART_AI_GATEWAY_URL ||
    process.env.LLM_GATEWAY_BASE_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

export function gatewayModel(): string {
  return (
    process.env.SPARE_PART_AI_MODEL ||
    process.env.LLM_GATEWAY_MODEL ||
    "claude-sonnet-4.6"
  );
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


async function callReverseproxy(content: AiContentBlock[], opts: AiCallOptions): Promise<string> {
  const response = await fetch(`${reverseproxyUrl()}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    body: JSON.stringify({
      model: reverseproxyModel(),
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
  return text;
}

function extractTextFromOpenAI(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : "";
}

async function callGateway(content: AiContentBlock[], opts: AiCallOptions): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const apiKey = gatewayKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  // Convert to OpenAI format
  const messages = content.map((block) => {
    if (block.type === "text") {
      return { role: "user", content: block.text || "" };
    }
    // Image block
    const mediaType = block.mediaType || "image/jpeg";
    return {
      role: "user",
      content: [
        { type: "text", text: block.text || "" },
        {
          type: "image_url",
          image_url: { url: `data:${mediaType};base64,${block.imageBase64}` },
        },
      ],
    };
  });

  const response = await fetch(`${gatewayBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    body: JSON.stringify({
      model: gatewayModel(),
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`gateway returned ${response.status}`);
  }
  const data = await response.json();
  return extractTextFromOpenAI(data);
}

export async function callPartAi(
  content: AiContentBlock[],
  opts: AiCallOptions = {},
): Promise<AiCallResult> {
  if (reverseproxyEnabled()) {
    try {
      const text = await callReverseproxy(content, opts);
      return { text, provider: "reverseproxy" };
    } catch (err) {
      console.warn(
        `reverseproxy failed (${(err as Error).message}), falling back to gateway`,
      );
    }
  }
  const text = await callGateway(content, opts);
  return { text, provider: "gateway" };
}
