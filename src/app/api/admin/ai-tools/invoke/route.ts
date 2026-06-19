import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { executeAiTool } from "@/lib/ai-assistant/tools";

// POST /api/admin/ai-tools/invoke
// Debug/admin endpoint to exercise AI tools directly against the DB,
// without routing through the LLM orchestrator.
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await requireRole(["ADMIN"]);

    const body = await request.json().catch(() => ({}));
    const { name, args = {} } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "กรุณาระบุ tool name" },
        { status: 400 },
      );
    }

    const context = {
      user: { id: user.id, role: user.role, name: user.name },
      channel: "web" as const,
    };

    const startedAt = Date.now();
    const result = await executeAiTool(name, args, context);
    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      name,
      args,
      latencyMs,
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const status =
        error.message === "Forbidden"
          ? 403
          : error.message === "PASSWORD_CHANGE_REQUIRED"
            ? 403
            : 401;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error(`ai-tools/invoke error (${ (error instanceof Error ? error.message : String(error)) })`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
