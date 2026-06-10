import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { confirmPendingAction } from "@/lib/ai-assistant/pending-actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const result = await confirmPendingAction({ id, userId: user.id, channel: "web" });
    return NextResponse.json({
      id: result.action.id,
      status: result.action.status,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ไม่สามารถยืนยันรายการได้" },
      { status: 400 }
    );
  }
}
