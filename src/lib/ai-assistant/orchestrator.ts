import { currentGatewayModel, currentVisionModel, gatewayBaseUrl, gatewayKey } from "@/lib/ai-client";
import {
  createConversation,
  findConversationForLineUser,
  getOrCreateConversation,
  getRecentMessages,
  saveMessage,
  type MessageRecord,
} from "@/lib/line-chat/memory";
import { prisma } from "@/lib/prisma";
import { getAiToolDefinitions, getAllInventoryToolDefinitions, executeAiTool } from "./tools";
import {
  hasSummaryTerms,
  hasInventoryContent,
  extractInventoryFilters,
} from "./intent-normalizer";
import { hasFlexRenderer } from "@/lib/line-chat/response-builder";
import type {
  AiAssistantInput,
  AiAssistantResult,
  AssistantToolCall,
  ToolExecutionContext,
} from "./types";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAiContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type ToolCall = {
  id: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
};

type ExecutedToolCalls = {
  executed: boolean;
  pendingActionIds: string[];
  toolCalls: AssistantToolCall[];
};

type StreamEvent =
  | { type: "status"; message: string }
  | { type: "delta"; text: string }
  | {
      type: "done";
      reply: string;
      conversationId?: string;
      pendingActionIds: string[];
      toolCalls?: AssistantToolCall[];
    };

const MAX_CONTEXT_MESSAGES = 20;
const TOOL_EXECUTION_TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยสต็อกอะไหล่ ตอบภาษาไทยกระชับ

กฎ:
- ถาม stock/part/location/building/block/จำนวนคงเหลือ → เรียก tool search_parts/get_stock_summary/get_low_stock/get_part_detail/list_buildings/web_search
- ค้นหา/หา/มีไหม [ชื่อ] → search_parts
- เหลือเท่าไหร่/สรุป/ภาพรวม → get_stock_summary
- ใกล้หมด/ต่ำกว่าขั้นต่ำ → get_low_stock
- ถ้าไม่มีในคลังหรือขอคำแนะนำ → web_search
- รับเข้า/เบิกออก/ปรับ/ย้าย/สร้าง → draft tool แล้วให้ผู้ใช้ยืนยัน
- ห้ามตอบเป็น text เมื่อถามเรื่องสต็อก ห้ามเดา`;

export async function runAiAssistant(
  input: AiAssistantInput,
): Promise<AiAssistantResult> {
  // Deterministic pre-router: skip LLM for common stock query patterns.
  // This prevents reasoning leaks and tool routing errors from the LLM.
  const directTool = tryDirectToolRouting(input.message);
  if (directTool) {
    const context: ToolExecutionContext = {
      user: input.user,
      channel: input.channel,
      conversationId: undefined,
    };

    const conversationId = await resolveConversationId(input);
    if (conversationId && !input.skipSaveUserMessage) {
      await saveMessage(
        conversationId,
        "user",
        input.message,
        input.attachments?.length ? "image" : "text",
        { channel: input.channel, attachments: input.attachments?.map((a) => ({ type: a.type, mediaType: a.mediaType })) },
      );
    }

    let content: string;
    let resultObject: unknown;
    let pendingActionId: string | undefined;
    try {
      const toolResult = await executeAiTool(directTool.name, directTool.args, context);
      content = toolResult.content;
      resultObject = toolResult.result;
      pendingActionId = toolResult.pendingActionId;
    } catch (error) {
      console.error(`Direct tool ${directTool.name} failed:`, error);
      // Fall through to LLM on failure
      return runAiAssistantViaLlm(input);
    }

    const toolCall: AssistantToolCall = {
      name: directTool.name,
      arguments: directTool.args,
      result: resultObject ?? content,
    };

    let reply: string;
    // For LINE channel, when a Flex card will be rendered, skip the LLM
    // summary round — the Flex card already shows the answer visually.
    const skipLlmSummary =
      input.channel === "line" &&
      hasFlexRenderer(directTool.name) &&
      !pendingActionId; // draft actions still need a text explanation
    try {
      if (skipLlmSummary) {
        reply = content; // raw JSON — Flex builder uses resultObject directly
      } else {
        // Use LLM only for generating the natural-language summary
        reply = await generateReplyFromToolResult(content, directTool.name);
      }
    } catch {
      reply = content;
    }

    reply = input.responseStyle === "line" ? sanitizeLineReply(reply) : sanitizeWebReply(reply);

    if (conversationId) {
      await saveMessage(conversationId, "assistant", reply, "text", {
        channel: input.channel,
        pendingActionIds: pendingActionId ? [pendingActionId] : [],
      });
    }

    return {
      reply,
      conversationId,
      pendingActionIds: pendingActionId ? [pendingActionId] : [],
      toolCalls: [toolCall],
    };
  }

  return runAiAssistantViaLlm(input);
}

/**
 * Deterministic pre-router: detect common stock query patterns
 * and return the tool call to execute directly, bypassing the LLM.
 * Returns null if no pattern matches (let LLM decide).
 */
function tryDirectToolRouting(
  message: string,
): { name: string; args: Record<string, unknown> } | null {
  const text = message.trim();
  if (!text || text.length < 4) return null;

  // Pattern 1: "สถานะ/สรุป/เหลือเท่าไหร่ [keyword]" or "[keyword] ใน block X อาคาร Y"
  // e.g. "สถานะอะไหล่เบรกเกอร์เป็นยังไงบ้าง", "contactor ใน block 1 อาคาร ท.003"
  if ((hasSummaryTerms(text) || /ใน.*block|ใน.*อาคาร|plant|building/i.test(text)) && hasInventoryContent(text)) {
    const filters = extractInventoryFilters(text);
    return {
      name: "get_stock_summary",
      args: {
        keyword: filters.keyword || undefined,
        plant: filters.plant,
        buildingName: filters.buildingName,
        categoryName: filters.categoryName,
      },
    };
  }

  // Pattern 2: "ใกล้หมด/ต่ำกว่าขั้นต่ำ"
  if (/(ใกล้หมด|ต่ำกว่าขั้นต่ำ|ต้องเติม|อะไรหมด|อันไหนใกล้หมด)/i.test(text)) {
    const filters = extractInventoryFilters(text);
    return {
      name: "get_low_stock",
      args: {
        plant: filters.plant,
        buildingName: filters.buildingName,
        categoryName: filters.categoryName,
      },
    };
  }

  // Pattern 3: "อาคาร" / "มีอาคารอะไรบ้าง"
  if (/^(อาคาร|ตึก|อาคารทั้งหมด|มีอาคารอะไรบ้าง|อาคารอะไรบ้าง|ดูอาคาร)/i.test(text) && !/\S/.test(text.replace(/^(อาคาร|ตึก|ดูอาคาร|อาคารทั้งหมด|มีอาคารอะไรบ้าง|อาคารอะไรบ้าง)/i, '').trim())) {
    return { name: "list_buildings", args: {} };
  }

  // Pattern 4: "บล็อก/Block" overview
  if (/^(บล็อก|บล็อค|block|ดูบล็อก|มีบล็อกอะไรบ้าง|บล็อกอะไรบ้าง)/i.test(text) && !/\S/.test(text.replace(/^(บล็อก|บล็อค|block|ดูบล็อก|มีบล็อกอะไรบ้าง|บล็อกอะไรบ้าง)/i, '').trim())) {
    return { name: "list_blocks", args: {} };
  }

  // Pattern 5: Exact part code query — "G7K-412S", "LC1D09"
  // When user sends just a part number (likely copy-pasted from label)
  // BUT skip if the message contains action intent words (เบิก, รับ, ปรับ, etc.)
  const isActionIntent = /(เบิก|รับ|เติม|ปรับ|ย้าย|ลด|เพิ่ม|แก้)/i.test(text);
  const compactCode = text.replace(/\s+/g, '').toUpperCase();
  if (!isActionIntent && /^[A-Z0-9][A-Z0-9._/-]{2,}$/i.test(compactCode) && /\d/.test(compactCode)) {
    return {
      name: "get_part_detail",
      args: { partNumber: compactCode },
    };
  }

  return null;
}

/**
 * Generate a natural-language reply from a tool result using the LLM.
 * Only used when we bypassed the LLM for tool routing.
 */
async function generateReplyFromToolResult(
  toolContent: string,
  toolName: string,
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "คุณเป็นผู้ช่วยจัดการสต็อกอะไหล่ ตอบภาษาไทย กระชับ 2-6 บรรทัด ห้ามใช้ markdown ห้ามโชว์ **ตัวหนา** ตอบจากข้อมูลที่ให้เท่านั้น ห้ามเดา",
    },
    {
      role: "user",
      content: `จากผลค้นหา (${toolName}): ${toolContent.slice(0, 3000)}\n\nสรุปข้อมูลสต็อกให้ผู้ใช้`,
    },
  ];

  const second = await callGateway(messages, false);
  return sanitizeRawToolMarkup(messageText(second.choices?.[0]?.message)) || toolContent;
}

/**
 * Original LLM-based assistant flow — used as fallback when
 * deterministic routing doesn't match.
 */
async function runAiAssistantViaLlm(
  input: AiAssistantInput,
): Promise<AiAssistantResult> {
  const conversationId = await resolveConversationId(input);
  if (conversationId && !input.skipSaveUserMessage) {
    await saveMessage(
      conversationId,
      "user",
      input.message,
      input.attachments?.length ? "image" : "text",
      {
        channel: input.channel,
        attachments: input.attachments?.map((attachment) => ({
          type: attachment.type,
          mediaType: attachment.mediaType,
        })),
      },
    );
  }

  const history = conversationId
    ? await getRecentMessages(conversationId, MAX_CONTEXT_MESSAGES)
    : [];
  const summaryNote = await buildGroupSummaryNote(input, conversationId);
  const messages = buildMessages(history, input, summaryNote);
  const context: ToolExecutionContext = {
    user: input.user,
    channel: input.channel,
    conversationId,
  };

  let pendingActionIds: string[] = [];
  let toolCalls: AssistantToolCall[] | undefined;
  let reply: string;
  try {
    const activeModel = input.attachments?.length
      ? await currentVisionModel()
      : await currentGatewayModel();
    const result = await callLlmWithTools(messages, context, input.channel, activeModel);
    reply = result.reply;
    pendingActionIds = result.pendingActionIds;
    toolCalls = result.toolCalls;
  } catch (error) {
    console.error("AI assistant failed:", error);
    reply = "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
  }

  reply =
    input.responseStyle === "line"
      ? sanitizeLineReply(reply)
      : sanitizeWebReply(reply);
  if (conversationId) {
    await saveMessage(conversationId, "assistant", reply, "text", {
      channel: input.channel,
      pendingActionIds,
    });
  }

  return { reply, conversationId, pendingActionIds, toolCalls };
}

/**
 * Web-stream variant of the deterministic pre-router used by LINE. Bypasses
 * LLM tool-calling for common stock read queries so weak/unsuitable models
 * cannot hallucinate "tool not connected" apologies.
 */
async function runDirectStreamRoute(
  input: AiAssistantInput,
  conversationId: string | undefined,
  context: ToolExecutionContext,
  onEvent: (event: StreamEvent) => void | Promise<void>,
): Promise<AiAssistantResult | null> {
  // Image/user upload flows must still go through the vision-capable LLM path
  // because deterministic routing cannot see the picture.
  if (input.attachments?.length) return null;

  const directTool = tryDirectToolRouting(input.message);
  if (!directTool) return null;

  await onEvent({ type: "status", message: "กำลังค้นข้อมูลในระบบสต็อก" });

  let toolResult: { content: string; result?: unknown; pendingActionId?: string };
  try {
    const executed = await executeAiTool(directTool.name, directTool.args, context);
    toolResult = executed;
  } catch (error) {
    console.error(`Direct tool ${directTool.name} failed in stream:`, error);
    return null;
  }

  const toolCall: AssistantToolCall = {
    name: directTool.name,
    arguments: directTool.args,
    result: toolResult.result ?? toolResult.content,
  };

  let reply: string;
  // For pending actions the tool already returned a confirmation message;
  // skip the summarization round to avoid flaky models mangling it.
  if (toolResult.pendingActionId) {
    reply = toolResult.content;
  } else {
    try {
      reply = await generateReplyFromToolResult(toolResult.content, directTool.name);
    } catch {
      reply = toolResult.content;
    }
  }

  reply =
    input.responseStyle === "line"
      ? sanitizeLineReply(reply)
      : sanitizeWebReply(reply);

  await streamTextFallback(reply, onEvent);

  if (conversationId) {
    await saveMessage(conversationId, "assistant", reply, "text", {
      channel: input.channel,
      pendingActionIds: toolResult.pendingActionId ? [toolResult.pendingActionId] : [],
    });
  }

  const pendingActionIds = toolResult.pendingActionId ? [toolResult.pendingActionId] : [];
  await onEvent({
    type: "done",
    reply,
    conversationId,
    pendingActionIds,
    toolCalls: [toolCall],
  });

  return { reply, conversationId, pendingActionIds, toolCalls: [toolCall] };
}

export async function runAiAssistantStream(
  input: AiAssistantInput,
  onEvent: (event: StreamEvent) => void | Promise<void>,
): Promise<AiAssistantResult> {
  const conversationId = await resolveConversationId(input);
  if (conversationId && !input.skipSaveUserMessage) {
    await saveMessage(
      conversationId,
      "user",
      input.message,
      input.attachments?.length ? "image" : "text",
      {
        channel: input.channel,
        attachments: input.attachments?.map((attachment) => ({
          type: attachment.type,
          mediaType: attachment.mediaType,
        })),
      },
    );
  }

  const history = conversationId
    ? await getRecentMessages(conversationId, MAX_CONTEXT_MESSAGES)
    : [];
  const summaryNote = await buildGroupSummaryNote(input, conversationId);
  const messages = buildMessages(history, input, summaryNote);
  const context: ToolExecutionContext = {
    user: input.user,
    channel: input.channel,
    conversationId,
  };

  // Deterministic pre-router: bypass LLM tool-calling for common read queries.
  const directResult = await runDirectStreamRoute(input, conversationId, context, onEvent);
  if (directResult) return directResult;

  const pendingActionIds: string[] = [];
  const toolCallResult: AssistantToolCall[] = [];
  let reply = "";
  try {
    await onEvent({ type: "status", message: "กำลังทำความเข้าใจคำถาม" });
    const activeModel = input.attachments?.length
      ? await currentVisionModel()
      : await currentGatewayModel();
    const first = await callGateway(messages, true, undefined, input.channel, activeModel);
    const choice = first.choices?.[0];
    if (!choice?.message) throw new Error("No response from LLM");

    const toolCalls = getToolCalls(choice.message);
    if (toolCalls.length > 0) {
      messages.push(asToolCallMessage(choice.message, toolCalls));
      await onEvent({ type: "status", message: "กำลังค้นข้อมูลในระบบสต็อก" });
      const executed = await executeToolCalls(toolCalls, messages, context);
      pendingActionIds.push(...executed.pendingActionIds);
      toolCallResult.push(...executed.toolCalls);

      await onEvent({ type: "status", message: "กำลังเรียบเรียงคำตอบ" });
      reply = await callGatewayStream(messages, false, async (delta) => {
        reply += delta;
        await onEvent({ type: "delta", text: delta });
      }, activeModel);
    } else {
      reply = messageText(choice.message) || "ขออภัย ไม่สามารถประมวลผลได้";
      await streamTextFallback(sanitizeRawToolMarkup(reply), onEvent);
    }
  } catch (error) {
    console.error("AI assistant stream failed:", error);
    reply = "ขออภัย เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
    await streamTextFallback(reply, onEvent);
  }

  reply =
    input.responseStyle === "line"
      ? sanitizeLineReply(reply)
      : sanitizeWebReply(reply);
  if (conversationId) {
    await saveMessage(conversationId, "assistant", reply, "text", {
      channel: input.channel,
      pendingActionIds,
    });
  }

  const toolCallsForReturn = toolCallResult.length > 0 ? toolCallResult : undefined;
  await onEvent({ type: "done", reply, conversationId, pendingActionIds, toolCalls: toolCallsForReturn });
  return { reply, conversationId, pendingActionIds, toolCalls: toolCallsForReturn };
}

async function resolveConversationId(
  input: AiAssistantInput,
): Promise<string | undefined> {
  if (input.conversationId) {
    if (input.channel === "web") {
      const conversation = await findConversationForLineUser(
        input.conversationId,
        `web:${input.user.id}`,
      );
      return conversation?.id;
    }
    return input.conversationId;
  }
  if (input.channel === "web") {
    const ctx = await createConversation(
      `web:${input.user.id}`,
      undefined,
    );
    return ctx.conversationId;
  }
  if (input.channel !== "line") return undefined;

  const ctx = await getOrCreateConversation(
    input.conversationScope?.isGroup
      ? undefined
      : input.conversationScope?.lineUserId,
    input.conversationScope?.lineGroupId,
  );
  return ctx.conversationId;
}

async function buildGroupSummaryNote(
  input: AiAssistantInput,
  conversationId?: string,
): Promise<string | undefined> {
  if (!input.conversationScope?.isGroup || !conversationId) return undefined;

  const total = await prisma.conversationMessage.count({
    where: { conversationId },
  });
  if (total <= MAX_CONTEXT_MESSAGES) return undefined;

  return `[กลุ่มแชต: แสดง ${MAX_CONTEXT_MESSAGES} ข้อความล่าสุดจากทั้งหมด ${total} ข้อความ ข้อความเก่ากว่านี้ถูกสรุป/ตัดทิ้ง]`;
}

function buildMessages(
  history: MessageRecord[],
  input: AiAssistantInput,
  summaryNote?: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (summaryNote) {
    messages.push({ role: "system", content: summaryNote });
  }

  for (const msg of history) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const userContent = buildUserContent(input);
  messages.push({ role: "user", content: userContent });
  return messages;
}

function buildUserContent(
  input: AiAssistantInput,
): string | OpenAiContentPart[] {
  if (!input.attachments?.length) return input.message;

  const parts: OpenAiContentPart[] = [
    { type: "text", text: input.message || "วิเคราะห์รูปนี้" },
  ];
  for (const attachment of input.attachments) {
    const mediaType = attachment.mediaType || "image/jpeg";
    parts.push({
      type: "image_url",
      image_url: { url: `data:${mediaType};base64,${attachment.imageBase64}` },
    });
  }
  return parts;
}

async function callLlmWithTools(
  messages: ChatMessage[],
  context: ToolExecutionContext,
  channel?: string,
  modelId?: string,
): Promise<{ reply: string; pendingActionIds: string[]; toolCalls: AssistantToolCall[] }> {
  // Phase 1: send a single "inventory_operation" router tool that covers both
  // read queries and draft actions. This avoids the ~1s per extra tool penalty
  // seen on providers like Umans, and makes draft actions fast (no read→draft
  // two-round hop) because the model can pick an action intent directly.
  const singleTool = getAllInventoryToolDefinitions();
  const first = await callGatewayWithTools(messages, singleTool, undefined, channel, modelId);
  const choice = first.choices?.[0];
  if (!choice?.message) throw new Error("No response from LLM");

  let toolCalls = getToolCalls(choice.message);

  // If LLM didn't call a tool, first retry with the single read tool forced.
  // Only fallback to draft action tool if there is action intent.
  if (toolCalls.length === 0) {
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    const lastUserText = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
    const hasActionIntent = /(เบิก|รับ|เติม|ปรับ|ย้าย|ลด|เพิ่ม|แก้|สร้าง)/i.test(lastUserText);

    if (toolCalls.length === 0 && channel === "line") {
      console.warn("Tools didn't match, retrying with single tool + required");
      try {
        const retry = await callGatewayWithTools(messages, singleTool, "required", channel, modelId);
        const retryChoice = retry.choices?.[0];
        if (retryChoice?.message) {
          const retryToolCalls = getToolCalls(retryChoice.message);
          if (retryToolCalls.length > 0) {
            toolCalls = retryToolCalls;
            choice.message = retryChoice.message;
          }
        }
      } catch (retryError) {
        console.error("Retry with single tool failed:", retryError);
      }
    }
  }

  if (toolCalls.length === 0) {
    return {
      reply:
        sanitizeRawToolMarkup(messageText(choice.message)) ||
        "ขออภัย ไม่สามารถประมวลผลได้",
      pendingActionIds: [],
      toolCalls: [],
    };
  }

  messages.push(asToolCallMessage(choice.message, toolCalls));
  const executed = await executeToolCalls(toolCalls, messages, context);

  // For LINE channel, when a Flex card will be rendered for a read tool,
  // skip the LLM summary round — the Flex card already shows the answer.
  const mainTool = executed.toolCalls[0];
  const hasPendingAction = executed.pendingActionIds.length > 0;
  const skipLlmSummary =
    channel === "line" &&
    mainTool &&
    hasFlexRenderer(mainTool.name) &&
    !hasPendingAction;

  // For pending actions, the tool already returned a nicely formatted
  // confirmation message. Skip the LLM summary to save latency and avoid
  // empty/error responses from the summarization model.
  if (hasPendingAction) {
    const raw = mainTool?.result ?? "ขออภัย ไม่สามารถประมวลผลได้";
    return {
      reply: typeof raw === "string" ? sanitizeRawToolMarkup(raw) : sanitizeRawToolMarkup(JSON.stringify(raw)),
      pendingActionIds: executed.pendingActionIds,
      toolCalls: executed.toolCalls,
    };
  }

  if (skipLlmSummary) {
    // Return raw tool content — Flex builder uses resultObject directly
    return {
      reply: mainTool?.result
        ? JSON.stringify(mainTool.result)
        : "ขออภัย ไม่สามารถประมวลผลได้",
      pendingActionIds: executed.pendingActionIds,
      toolCalls: executed.toolCalls,
    };
  }

  const second = await callGateway(messages, false, undefined, channel, modelId);
  return {
    reply:
      sanitizeRawToolMarkup(messageText(second.choices?.[0]?.message)) ||
      "ขออภัย ไม่สามารถประมวลผลได้",
    pendingActionIds: executed.pendingActionIds,
    toolCalls: executed.toolCalls,
  };
}

async function callGateway(messages: ChatMessage[], includeTools: boolean, toolChoice?: string, channel?: string, modelId?: string) {
  return callGatewayWithTools(
    messages,
    includeTools ? getAiToolDefinitions() : [],
    toolChoice,
    channel,
    modelId,
  );
}

async function callGatewayWithTools(
  messages: ChatMessage[],
  tools: unknown[] | null,
  toolChoice?: string,
  _channel?: string,
  modelId?: string,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const apiKey = gatewayKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${gatewayBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: modelId || (await currentGatewayModel()),
      max_tokens: 2000,
      temperature: 0.2,
      stream: true,
      messages,
      ...(tools && tools.length > 0
        ? { tools, tool_choice: toolChoice || "auto" }
        : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway returned ${response.status}: ${text}`);
  }

  const raw = await response.text();
  return parseGatewayResponse(raw) as {
    choices?: Array<{
      message?: ChatMessage;
    }>;
  };
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  messages: ChatMessage[],
  context: ToolExecutionContext,
): Promise<ExecutedToolCalls> {
  const pendingActionIds: string[] = [];
  const executedToolCalls: AssistantToolCall[] = [];

  for (const toolCall of toolCalls) {
    const name = toolCall.function?.name;
    const args = parseToolArguments(toolCall.function?.arguments);
    if (!name) {
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: "ไม่พบชื่อ tool",
      });
      continue;
    }

    let content: string;
    let resultObject: unknown;
    try {
      const toolResult = await withTimeout(
        executeAiTool(name, normalizeToolArgs(name, args), context),
        TOOL_EXECUTION_TIMEOUT_MS,
        `Tool ${name}`,
      );
      content = toolResult.content;
      resultObject = toolResult.result;
      if (toolResult.pendingActionId) pendingActionIds.push(toolResult.pendingActionId);
    } catch (error) {
      console.error(`AI tool ${name} failed:`, error);
      content =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดในการเรียก tool";
      resultObject = undefined;
    }

    messages.push({
      role: "tool",
      tool_call_id: toolCall.id,
      content,
    });

    executedToolCalls.push({
      name,
      arguments: args,
      result: resultObject ?? content,
    });
  }

  return { executed: toolCalls.length > 0, pendingActionIds, toolCalls: executedToolCalls };
}

function parseToolResult(name: string, content: string): unknown {
  try {
    const parsed = JSON.parse(content);
    if (name === "search_parts" && typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    if (name.startsWith("get_") || name === "search_parts") {
      return parsed;
    }
  } catch {
    // Not JSON — return as-is via the string content path.
  }
  return undefined;
}

function getToolCalls(message?: ChatMessage): ToolCall[] {
  if (!message) return [];
  const structured = message.tool_calls || [];
  const textual = parseTextToolCalls(messageText(message));
  return structured.length > 0 ? structured : textual;
}

function asToolCallMessage(
  message: ChatMessage,
  toolCalls: ToolCall[],
): ChatMessage {
  return {
    role: "assistant",
    content: message.tool_calls?.length ? message.content : undefined,
    tool_calls: toolCalls,
  };
}

function parseTextToolCalls(text: string): ToolCall[] {
  if (!text) return [];

  const calls: ToolCall[] = [];

  // Format 1: <arg_key> XML blocks
  if (/<tool_call\b/i.test(text)) {
    const blockRegex = /<tool_call\b[^>]*>([\s\S]*?)<\/tool_call>/gi;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = blockRegex.exec(text))) {
      const block = blockMatch[1];
      const functionMatch = block.match(
        /<function=([a-zA-Z0-9_.:-]+)\b[^>]*>([\s\S]*?)<\/function>/i,
      );
      if (!functionMatch) continue;

      const args: Record<string, string> = {};
      const paramRegex =
        /<parameter=([a-zA-Z0-9_.:-]+)\b[^>]*>([\s\S]*?)<\/parameter>/gi;
      let paramMatch: RegExpExecArray | null;
      while ((paramMatch = paramRegex.exec(functionMatch[2]))) {
        args[paramMatch[1]] = decodeXmlText(paramMatch[2].trim());
      }

      calls.push({
        id: `text-tool-${calls.length + 1}`,
        type: "function",
        function: {
          name: functionMatch[1],
          arguments: JSON.stringify(args),
        },
      });
    }
  }

  // Format 2: eligible_function=tool_name:0{"arg": "value"}
  // Some models (Kimi K2.x) emit this instead of proper tool_calls
  const eligibleRegex = /eligible_function=([a-zA-Z0-9_.:-]+):\d+(\{[^}]*\})/g;
  let eligibleMatch: RegExpExecArray | null;
  while ((eligibleMatch = eligibleRegex.exec(text))) {
    const name = eligibleMatch[1];
    const argsRaw = eligibleMatch[2];
    let parsedArgs: Record<string, unknown>;
    try {
      parsedArgs = JSON.parse(argsRaw);
    } catch {
      parsedArgs = {};
    }
    calls.push({
      id: `eligible-tool-${calls.length + 1}`,
      type: "function",
      function: {
        name,
        arguments: JSON.stringify(parsedArgs),
      },
    });
  }

  return calls;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeToolArgs(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (name !== "search_parts") return args;
  const next = { ...args };
  if (next.keyword === "*") next.keyword = "";
  if (!next.keyword && (next.building || next.buildingId || next.plant))
    next.keyword = "";
  return next;
}

async function callGatewayStream(
  messages: ChatMessage[],
  includeTools: boolean,
  onDelta: (delta: string) => void | Promise<void>,
  modelId?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const apiKey = gatewayKey();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${gatewayBaseUrl()}/v1/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: modelId || (await currentGatewayModel()),
      max_tokens: 2000,
      temperature: 0.2,
      stream: true,
      messages,
      ...(includeTools
        ? { tools: getAiToolDefinitions(), tool_choice: "auto" }
        : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gateway returned ${response.status}: ${text}`);
  }

  if (!response.body) {
    const parsed = parseGatewayResponse(await response.text());
    return messageText(parsed.choices?.[0]?.message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index: number;
    while ((index = buffer.indexOf("\n\n")) >= 0) {
      const event = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const delta = parseSseDelta(event);
      if (delta) {
        text += delta;
        await onDelta(delta);
      }
    }
  }

  return text.trim();
}

function parseGatewayResponse(raw: string): {
  choices?: Array<{
    message?: ChatMessage;
  }>;
} {
  if (!raw.trim().startsWith("data:")) {
    return JSON.parse(raw) as { choices?: Array<{ message?: ChatMessage }> };
  }

  // Parse SSE stream: accumulate content + tool_calls from delta chunks
  let content = "";
  const toolCallAccumulators = new Map<number, { id: string; name: string; arguments: string }>();

  for (const event of raw.split(/\n\n/)) {
    const line = event.split(/\r?\n/).find((item) => item.startsWith("data:"));
    if (!line) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning_content?: string;
            tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) content += delta.content;
      // Accumulate tool_calls from streaming delta
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          let acc = toolCallAccumulators.get(idx);
          if (!acc) {
            acc = { id: "", name: "", arguments: "" };
            toolCallAccumulators.set(idx, acc);
          }
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }
    } catch {
      // Skip malformed event
    }
  }

  // Build message with tool_calls if any were found
  const message: ChatMessage = { role: "assistant", content: content.trim() || undefined };
  if (toolCallAccumulators.size > 0) {
    const toolCalls: ToolCall[] = [...toolCallAccumulators.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, acc]) => ({
        id: acc.id || `stream-tool-${acc.name}`,
        type: "function" as const,
        function: {
          name: acc.name,
          arguments: acc.arguments,
        },
      }));
    message.tool_calls = toolCalls;
  }

  return {
    choices: [{ message }],
  };
}

function parseSseDelta(event: string): string {
  const line = event.split(/\r?\n/).find((item) => item.startsWith("data:"));
  if (!line) return "";
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return "";
  try {
    const parsed = JSON.parse(data) as {
      choices?: Array<{
        delta?: { content?: string; reasoning_content?: string };
        message?: { content?: string };
      }>;
    };
    // Only return delta.content (the actual answer), NOT reasoning_content (chain-of-thought).
    // Kimi K2.6 and similar models emit reasoning_content separately — we must ignore it
    // to prevent thinking text from leaking to the user.
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) return delta.content;
    // Fallback: non-streaming message content
    return parsed.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

function parseToolArguments(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function messageText(message?: ChatMessage): string {
  const content = message?.content;
  return typeof content === "string" ? content.trim() : "";
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function streamTextFallback(
  text: string,
  onEvent: (event: StreamEvent) => void | Promise<void>,
): Promise<void> {
  const chunks = text.match(/.{1,28}(\s|$)/g) || [text];
  for (const chunk of chunks) {
    await onEvent({ type: "delta", text: chunk });
  }
}

function sanitizeLineReply(reply: string): string {
  return sanitizeRawToolMarkup(reply)
    // Strip thinking/reasoning patterns that LLM sometimes leaks
    .replace(/^ผู้ใช้ถาม.*?$/gm, "")
    .replace(/^ซึ่งเป็นคำถาม.*?$/gm, "")
    .replace(/^ดังนั้นควรใช้.*?$/gm, "")
    .replace(/^ผมจะใช้.*?$/gm, "")
    .replace(/^ฉันจะใช้.*?$/gm, "")
    .replace(/^ควรใช้ tool.*?$/gm, "")
    .replace(/^จะเรียก.*?$/gm, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*_]{3,}\s*$/gm, "")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

function sanitizeWebReply(reply: string): string {
  return sanitizeRawToolMarkup(reply).trim();
}

function sanitizeRawToolMarkup(reply: string): string {
  return reply
    .replace(/<tool_call\b[^>]*>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function=[^>]+>[\s\S]*?<\/function>/gi, "")
    .trim();
}

/**
 * Detect if the LLM's reply is reasoning/thinking text instead of a tool call.
 * This happens when the model explains why it should call a tool instead of
 * actually calling it.
 */
function looksLikeReasoning(text: string): boolean {
  if (!text || text.length < 20) return false;
  const patterns = [
    /ผู้ใช้ถาม/i,
    /ควรใช้ (tool|เครื่องมือ)/i,
    /ดังนั้นควร/i,
    /จะเรียกใช้/i,
    /จะใช้ get_stock/i,
    /จะใช้ search_parts/i,
    /ซึ่งเป็นคำถามเกี่ยวกับ/i,
    /เพื่อให้ได้ข้อมูล/i,
  ];
  const matchCount = patterns.filter((p) => p.test(text)).length;
  return matchCount >= 2;
}
