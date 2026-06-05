import { createHmac, timingSafeEqual } from "crypto";

export interface LineIdTokenPayload {
  sub: string;
  aud: string;
  name?: string;
  picture?: string;
  iat?: number;
  exp?: number;
}

export class LineTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineTokenError";
  }
}

export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenPayload> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) {
    throw new LineTokenError("LINE_LOGIN_CHANNEL_ID is not configured");
  }

  const form = new URLSearchParams();
  form.append("id_token", idToken);
  form.append("client_id", clientId);

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LineTokenError(`LINE token verification failed: ${res.status} ${text}`);
  }

  const payload = await res.json();
  if (!payload.sub || !payload.aud) {
    throw new LineTokenError("Invalid LINE token payload");
  }

  return payload as LineIdTokenPayload;
}

export interface LineWebhookEvent {
  type: "message" | "follow" | "unfollow" | "join" | "leave" | "postback";
  replyToken?: string;
  source?: { type: "user" | "group" | "room"; userId?: string; groupId?: string; roomId?: string };
  message?: {
    type: "text" | "image" | "video" | "audio" | "location" | "sticker";
    id: string;
    text?: string;
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    console.error("LINE_CHANNEL_SECRET is not configured");
    return false;
  }

  const hmac = createHmac("SHA256", secret);
  hmac.update(body, "utf8");
  const digest = hmac.digest("base64");

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

interface LineReplyMessage {
  type: "text" | "flex";
  text?: string;
  altText?: string;
  contents?: unknown;
}

export async function sendLineReply(
  replyToken: string,
  messages: LineReplyMessage[]
): Promise<void> {
  await sendLineMessages("reply", { replyToken, messages });
}

// Helper: สร้าง text message
export function createTextMessage(text: string): LineReplyMessage {
  return { type: "text", text };
}

// Helper: สร้าง flex message
export function createFlexMessage(altText: string, contents: unknown): LineReplyMessage {
  return { type: "flex", altText, contents };
}

export async function pushLineMessage(
  to: string,
  messages: LineReplyMessage[]
): Promise<void> {
  await sendLineMessages("push", { to, messages });
}

async function sendLineMessages(
  endpoint: "reply" | "push",
  payload: { replyToken?: string; to?: string; messages: LineReplyMessage[] }
): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  // Convert Flex messages to LINE API format
  const formattedMessages = payload.messages.map((msg) => {
    if (msg.type === "flex") {
      return {
        type: "flex",
        altText: msg.altText || "ข้อความ",
        contents: msg.contents,
      };
    }
    return msg;
  });

  const res = await fetch(`https://api.line.me/v2/bot/message/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ...payload, messages: formattedMessages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE ${endpoint} failed: ${res.status} ${text}`);
  }
}
