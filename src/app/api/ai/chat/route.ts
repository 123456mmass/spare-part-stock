import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireAuth } from "@/lib/auth";
import { runAiAssistant } from "@/lib/ai-assistant/orchestrator";

const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  attachments: z
    .array(
      z.object({
        type: z.literal("image"),
        imageBase64: z.string().min(1),
        mediaType: z.string().optional(),
      })
    )
    .max(3)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await runAiAssistant({
      user: { id: user.id, role: user.role, name: user.name },
      channel: "web",
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
      attachments: parsed.data.attachments,
      responseStyle: "web",
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat route error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI" }, { status: 500 });
  }
}
