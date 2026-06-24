import { z } from "zod";
import { NextResponse } from "next/server";
import { AuthError, requireAuthFromRequest } from "@/lib/auth";
import { runAiAssistantStream } from "@/lib/ai-assistant/orchestrator";
import { corsOptions, withCors } from "@/lib/cors";

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

export const OPTIONS = corsOptions();

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);
    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const encoder = new TextEncoder();
    let closed = false;
    const abortSignal = request.signal;
    if (abortSignal.aborted) {
      closed = true;
    } else {
      abortSignal.addEventListener(
        "abort",
        () => {
          closed = true;
        },
        { once: true }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runAiAssistantStream(
            {
              user: { id: user.id, role: user.role, name: user.name },
              // Reuse the web conversation model so chat history is shared
              // across web + mobile for the same user.
              channel: "web",
              conversationId: parsed.data.conversationId,
              message: parsed.data.message,
              attachments: parsed.data.attachments,
              responseStyle: "web",
            },
            (event) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(sse(event.type, event)));
              } catch (enqueueError) {
                console.error("AI stream enqueue error:", enqueueError);
                closed = true;
              }
            },
            abortSignal
          );
        } catch (error) {
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(
                  sse("error", {
                    message:
                      error instanceof Error
                        ? error.message
                        : "เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI",
                  })
                )
              );
            } catch (enqueueError) {
              console.error("AI stream error enqueue failed:", enqueueError);
            }
          }
        } finally {
          try {
            if (!closed) controller.close();
          } catch {
            // controller may already be closed
          }
          closed = true;
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 }
      );
    }
    console.error("Mobile AI chat stream route error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI" },
      { status: 500 }
    );
  }
});
