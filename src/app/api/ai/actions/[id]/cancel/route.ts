import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPendingAction } from "@/lib/ai-assistant/pending-actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const action = await cancelPendingAction({ id, userId: user.id });
    const message = "ยกเลิกรายการแล้ว";
    if (action.conversationId) {
      await prisma.conversationMessage.create({
        data: {
          conversationId: action.conversationId,
          role: "assistant",
          content: message,
          messageType: "text",
          metadata: JSON.stringify({ actionId: action.id, actionStatus: action.status }),
        },
      });
    }
    return NextResponse.json({
      id: action.id,
      status: action.status,
      message,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถยกเลิกรายการได้" },
      { status: 400 }
    );
  }
}
