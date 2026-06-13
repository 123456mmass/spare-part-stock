import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanupOldMessages } from "@/lib/line-chat/memory";

/**
 * Periodic backup cleanup for group/room LINE conversation context.
 *
 * Main pruning is done lazily in the webhook when a group exceeds 120 messages.
 * This endpoint is the safety net for high-traffic groups or missed events.
 */
const KEEP_LAST = 100;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If no secret is configured, refuse to run so we don't expose an open endpoint.
    return false;
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^bearer\s+/i, "").trim();
  return token === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all group/room conversations and prune them down to KEEP_LAST.
    const conversations = await prisma.conversation.findMany({
      where: { lineGroupId: { not: null } },
      select: { id: true },
    });

    let prunedCount = 0;
    let failedCount = 0;

    for (const conversation of conversations) {
      try {
        const deleted = await cleanupOldMessages(conversation.id, KEEP_LAST);
        prunedCount += deleted;
      } catch (error) {
        failedCount++;
        console.error(`Cleanup failed for conversation ${conversation.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      conversationsProcessed: conversations.length,
      messagesPruned: prunedCount,
      conversationsFailed: failedCount,
    });
  } catch (error) {
    console.error("Cleanup cron error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 },
    );
  }
}
