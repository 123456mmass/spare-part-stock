// AI Orchestrator for LINE Chat
// จัดการ conversation flow: load history → build prompt → call LLM with tools → save messages

import { gatewayBaseUrl, gatewayKey, gatewayModel } from "@/lib/ai-client";
import {
  getOrCreateConversation,
  getRecentMessages,
  saveMessage,
  type MessageRecord,
} from "./memory";
import { TOOL_DEFINITIONS, executeTool } from "./tools";

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยจัดการสต็อกอะไหล่ (Spare Part Inventory Assistant) ของระบบ SparePart Stock

หน้าที่ของคุณ:
- ค้นหาอะไหล่จากชื่อ รหัส หรือตำแหน่ง
- ดูจำนวนสต็อกและสถิติ
- ตอบคำถามเกี่ยวกับอะไหล่และสต็อก

กฎ:
- ตอบเป็นภาษาไทย
- ตอบสั้น กระชับ ตรงประเด็น
- ใช้ emoji เล็กน้อยเพื่อความสวยงาม
- ถ้าไม่แน่ใจ ให้ถามกลับเพื่อความชัดเจน
- ถ้าผู้ใช้ถามถึง "ตัวนี้" หรือ "อันนี้" ให้ใช้บริบทจากข้อความก่อนหน้า
- ใช้ tool เมื่อจำเป็นเท่านั้น ไม่ต้องใช้ทุกครั้ง
- สำหรับคำถามทั่วไปที่ไม่เกี่ยวกับสต็อก ให้ตอบสั้นๆ แล้วถามว่ามีอะไรให้ช่วยเรื่องสต็อกไหม

ตัวอย่างการใช้ tool:
- "contactor เหลือเท่าไหร่" → ใช้ search_parts(keyword="contactor")
- "LC1D09 เหลือกี่ตัว" → ใช้ get_stock(code="LC1D09")
- "สรุปสต็อก" → ใช้ get_stock_stats()
- "มีอาคารอะไรบ้าง" → ใช้ list_buildings()`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

// Max messages to include in context
const MAX_CONTEXT_MESSAGES = 20;

export type OrchestratorResult = {
  reply: string;
  conversationId: string;
};

export async function orchestrate(
  lineUserId: string,
  lineGroupId: string | undefined,
  userMessage: string,
  isGroup: boolean
): Promise<OrchestratorResult> {
  // 1. Get or create conversation
  const ctx = await getOrCreateConversation(
    isGroup ? undefined : lineUserId,
    lineGroupId
  );

  // 2. Save user message
  await saveMessage(ctx.conversationId, "user", userMessage, "text");

  // 3. Load recent messages for context
  const recentMessages = await getRecentMessages(
    ctx.conversationId,
    MAX_CONTEXT_MESSAGES
  );

  // 4. Build messages array for LLM
  const messages = buildMessages(recentMessages);

  // 5. Call LLM with tools
  let reply: string;
  try {
    reply = await callLlmWithTools(messages);
  } catch (error) {
    console.error("LLM call failed:", error);
    reply = "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
  }

  // 6. Save assistant message
  await saveMessage(ctx.conversationId, "assistant", reply, "text");

  return {
    reply,
    conversationId: ctx.conversationId,
  };
}

function buildMessages(history: MessageRecord[]): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  // Add conversation history (exclude very old messages)
  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return messages;
}

async function callLlmWithTools(messages: ChatMessage[]): Promise<string> {
  const baseUrl = gatewayBaseUrl();
  const apiKey = gatewayKey();
  const model = gatewayModel();

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  // First call: let LLM decide if it needs tools
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("No response from LLM");
  }

  // Check if LLM wants to call tools
  const toolCalls = choice.message?.tool_calls;
  if (toolCalls && toolCalls.length > 0) {
    // Execute tools and call LLM again
    return await handleToolCalls(messages, choice.message, toolCalls);
  }

  // Direct text response
  return choice.message?.content?.trim() || "ขออภัย ไม่สามารถประมวลผลได้";
}

async function handleToolCalls(
  messages: ChatMessage[],
  assistantMessage: ChatMessage,
  toolCalls: ToolCall[]
): Promise<string> {
  const baseUrl = gatewayBaseUrl();
  const apiKey = gatewayKey();
  const model = gatewayModel();

  // Add assistant message with tool calls
  messages.push(assistantMessage);

  // Execute each tool and add results
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function?.name;
    if (!functionName) {
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: "เกิดข้อผิดพลาด: ไม่พบชื่อ tool",
      });
      continue;
    }

    let functionArgs: Record<string, string> = {};

    try {
      functionArgs = JSON.parse(toolCall.function?.arguments || "{}");
    } catch {
      // Invalid JSON args
    }

    let result: string;
    try {
      result = await executeTool(functionName, functionArgs);
    } catch (error) {
      console.error(`Tool ${functionName} error:`, error);
      result = `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : "Unknown error"}`;
    }

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content: result,
    });
  }

  // Second call to get final response
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.3,
      stream: false,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "ขออภัย ไม่สามารถประมวลผลได้";
}
