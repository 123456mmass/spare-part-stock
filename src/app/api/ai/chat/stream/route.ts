import { z } from "zod";
import { AuthError, requireAuth } from "@/lib/auth";
import { runAiAssistantStream } from "@/lib/ai-assistant/orchestrator";

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

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
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
      abortSignal.addEventListener("abort", () => {
        closed = true;
      }, { once: true });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runAiAssistantStream(
            {
              user: { id: user.id, role: user.role, name: user.name },
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
            abortSignal,
          );
        } catch (error) {
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(
                  sse("error", {
                    message: error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI",
                  }),
                ),
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
        // Client disconnected — stop enqueuing. The threaded abortSignal
        // (request.signal) also aborts the upstream gateway fetch.
        closed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.message === "Forbidden" ? 403 : 401 });
    }
    console.error("AI chat stream route error:", error);
    return Response.json({ error: "เกิดข้อผิดพลาดในการเรียกผู้ช่วย AI" }, { status: 500 });
  }
}
