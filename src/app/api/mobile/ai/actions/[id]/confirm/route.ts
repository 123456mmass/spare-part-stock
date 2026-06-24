import { NextResponse } from "next/server";
import { AuthError, requireAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmPendingAction } from "@/lib/ai-assistant/pending-actions";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const POST = withCors(async (_request: Request, context: RouteContext) => {
  try {
    const user = await requireAuthFromRequest(_request);
    const { id } = await context.params;
    const result = await confirmPendingAction({
      id,
      userId: user.id,
      channel: "web",
    });
    if (result.action.conversationId) {
      await prisma.conversationMessage.create({
        data: {
          conversationId: result.action.conversationId,
          role: "assistant",
          content: result.message,
          messageType: "text",
          metadata: JSON.stringify({
            actionId: result.action.id,
            actionStatus: result.action.status,
          }),
        },
      });
    }
    return NextResponse.json({
      id: result.action.id,
      status: result.action.status,
      message: result.message,
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
          error instanceof Error ? error.message : "ไม่สามารถยืนยันรายการได้",
      },
      { status: 400 }
    );
  }
});
