import { NextResponse } from "next/server";
import { AuthError, requireAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelPendingAction } from "@/lib/ai-assistant/pending-actions";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withCors(async (_request: Request, context: RouteContext) => {
  try {
    const user = await requireAuthFromRequest(_request);
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
          metadata: JSON.stringify({
            actionId: action.id,
            actionStatus: action.status,
          }),
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
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 }
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "ไม่สามารถยกเลิกรายการได้",
      },
      { status: 400 }
    );
  }
});
