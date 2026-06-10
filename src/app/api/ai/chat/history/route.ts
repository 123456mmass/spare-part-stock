import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();
    const conversation = await prisma.conversation.findFirst({
      where: { lineUserId: `web:${user.id}`, lineGroupId: null },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          where: { role: { in: ["user", "assistant"] } },
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ conversationId: null, messages: [] });
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        metadata: message.metadata ? safeJson(message.metadata) : null,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat history route error:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดประวัติแชทได้" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireAuth();
    await prisma.conversation.deleteMany({
      where: { lineUserId: `web:${user.id}`, lineGroupId: null },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat history delete route error:", error);
    return NextResponse.json({ error: "ไม่สามารถล้างประวัติแชทได้" }, { status: 500 });
  }
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
