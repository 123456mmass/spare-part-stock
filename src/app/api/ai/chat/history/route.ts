import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const webLineUserId = `web:${user.id}`;
    const requestedConversationId =
      request.nextUrl.searchParams.get("conversationId") || undefined;
    const conversations = await prisma.conversation.findMany({
      where: { lineUserId: webLineUserId, lineGroupId: null },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        messages: {
          where: { role: "user" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    const selectedConversationId =
      requestedConversationId &&
      conversations.some(
        (conversation) => conversation.id === requestedConversationId,
      )
        ? requestedConversationId
        : conversations[0]?.id;

    const conversation = selectedConversationId
      ? await prisma.conversation.findFirst({
          where: {
            id: selectedConversationId,
            lineUserId: webLineUserId,
            lineGroupId: null,
          },
          include: {
            messages: {
              where: { role: { in: ["user", "assistant"] } },
              orderBy: { createdAt: "asc" },
              take: 100,
            },
          },
        })
      : null;

    if (!conversation) {
      return NextResponse.json({
        conversationId: null,
        conversations: conversations.map((item) => ({
          id: item.id,
          title: item.messages[0]?.content || "แชตใหม่",
          updatedAt: item.updatedAt,
        })),
        messages: [],
      });
    }

    const parsedMessages = conversation.messages.map((message) => {
      const metadata = message.metadata ? safeJson(message.metadata) : null;
      return { message, metadata };
    });
    const pendingIds = [
      ...new Set(
        parsedMessages.flatMap(({ metadata }) =>
          isRecord(metadata) && Array.isArray(metadata.pendingActionIds)
            ? metadata.pendingActionIds.filter((id): id is string => typeof id === "string")
            : [],
        ),
      ),
    ];
    const activePendingIds = new Set(
      pendingIds.length > 0
        ? (
            await prisma.aiPendingAction.findMany({
              where: { id: { in: pendingIds }, status: "PENDING", expiresAt: { gt: new Date() } },
              select: { id: true },
            })
          ).map((action) => action.id)
        : [],
    );

    return NextResponse.json({
      conversationId: conversation.id,
      conversations: conversations.map((item) => ({
        id: item.id,
        title: item.messages[0]?.content || "แชตใหม่",
        updatedAt: item.updatedAt,
      })),
      messages: parsedMessages.map(({ message, metadata }) => {
        const nextMetadata = isRecord(metadata) ? { ...metadata } : null;
        if (nextMetadata && Array.isArray(nextMetadata.pendingActionIds)) {
          nextMetadata.pendingActionIds = nextMetadata.pendingActionIds.filter(
            (id) => typeof id === "string" && activePendingIds.has(id),
          );
        }
        return {
          id: message.id,
          role: message.role,
          content: message.content,
          metadata: nextMetadata,
          createdAt: message.createdAt,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat history route error:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดประวัติแชทได้" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const webLineUserId = `web:${user.id}`;
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (conversationId) {
      await prisma.conversation.deleteMany({
        where: {
          id: conversationId,
          lineUserId: webLineUserId,
          lineGroupId: null,
        },
      });
    } else {
      await prisma.conversation.deleteMany({
        where: { lineUserId: webLineUserId, lineGroupId: null },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat history delete route error:", error);
    return NextResponse.json({ error: "ไม่สามารถลบประวัติแชทได้" }, { status: 500 });
  }
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
