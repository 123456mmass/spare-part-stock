// Conversation memory management for LINE AI Chat
// เก็บและค้นหาประวัติการสนทนา

import { prisma } from "@/lib/prisma";
import { findRelevant } from "./embeddings";

export type ConversationContext = {
  conversationId: string;
  lineUserId?: string;
  lineGroupId?: string;
  isNewConversation: boolean;
};

export type MessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  messageType: string;
  metadata: unknown;
  createdAt: Date;
};

export async function createConversation(
  lineUserId?: string,
  lineGroupId?: string
): Promise<ConversationContext> {
  if (!lineUserId && !lineGroupId) {
    throw new Error("lineUserId or lineGroupId required");
  }

  const created = await prisma.conversation.create({
    data: {
      lineUserId: lineUserId || null,
      lineGroupId: lineGroupId || null,
    },
  });

  return {
    conversationId: created.id,
    lineUserId: created.lineUserId ?? undefined,
    lineGroupId: created.lineGroupId ?? undefined,
    isNewConversation: true,
  };
}

export async function findConversationForLineUser(
  conversationId: string,
  lineUserId: string
) {
  return prisma.conversation.findFirst({
    where: {
      id: conversationId,
      lineUserId,
      lineGroupId: null,
    },
    select: { id: true },
  });
}

// หรือสร้าง conversation ใหม่ (1 ต่อ user หรือ 1 ต่อ group)
export async function getOrCreateConversation(
  lineUserId?: string,
  lineGroupId?: string
): Promise<ConversationContext> {
  if (!lineUserId && !lineGroupId) {
    throw new Error("lineUserId or lineGroupId required");
  }

  // ค้นหา conversation ล่าสุด
  const existing = await prisma.conversation.findFirst({
    where: {
      lineUserId: lineUserId || null,
      lineGroupId: lineGroupId || null,
    },
    orderBy: { updatedAt: "desc" },
  });

  // ถ้าเจอ ใช้อันเดิม (ต่อให้ข้ามวัน ก็ใช้อันเดิมเพื่อ context ต่อเนื่อง)
  if (existing) {
    return {
      conversationId: existing.id,
      lineUserId: existing.lineUserId ?? undefined,
      lineGroupId: existing.lineGroupId ?? undefined,
      isNewConversation: false,
    };
  }

  return createConversation(lineUserId, lineGroupId);
}

export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  messageType: string = "text",
  metadata?: unknown
): Promise<MessageRecord> {
  const message = await prisma.conversationMessage.create({
    data: {
      conversationId,
      role,
      content,
      messageType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  // อัพเดท updatedAt ของ conversation
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    content: message.content,
    messageType: message.messageType,
    metadata: message.metadata ? safeParseJSON(message.metadata) : null,
    createdAt: message.createdAt,
  };
}

// ดึงข้อความล่าสุด (default 20)
export async function getRecentMessages(
  conversationId: string,
  limit: number = 20
): Promise<MessageRecord[]> {
  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.reverse().map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
    messageType: m.messageType,
    metadata: m.metadata ? safeParseJSON(m.metadata) : null,
    createdAt: m.createdAt,
  }));
}

// ค้นหา messages ที่เกี่ยวข้องกับ query (Phase 1: keyword matching)
export async function searchRelevantMessages(
  conversationId: string,
  query: string,
  topK: number = 5
): Promise<(MessageRecord & { relevance: number })[]> {
  const allMessages = await prisma.conversationMessage.findMany({
    where: { conversationId, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: 50, // ค้นจาก 50 ข้อความล่าสุด
  });

  const candidates = allMessages.map((m) => ({
    id: m.id,
    content: m.content,
  }));

  const relevant = findRelevant(query, candidates, topK);

  return relevant
    .map((r) => {
      const m = allMessages.find((x) => x.id === r.id);
      if (!m) return null;
      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        messageType: m.messageType,
        metadata: m.metadata ? safeParseJSON(m.metadata) : null,
        createdAt: m.createdAt,
        relevance: r.score,
      };
    })
    .filter((m): m is MessageRecord & { relevance: number } => m !== null);
}

// ลบข้อความเก่า (สำหรับ cleanup)
export async function cleanupOldMessages(
  conversationId: string,
  keepLast: number = 100
): Promise<number> {
  const all = await prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (all.length <= keepLast) return 0;

  const toDelete = all.slice(keepLast).map((m) => m.id);
  const result = await prisma.conversationMessage.deleteMany({
    where: { id: { in: toDelete } },
  });

  return result.count;
}

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
