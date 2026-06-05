import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePartFromCode } from "@/lib/part-lookup";
import {
  verifyLineSignature,
  sendLineReply,
  createTextMessage,
  createFlexMessage,
  type LineWebhookBody,
} from "@/lib/line";
import { orchestrate } from "@/lib/line-chat/orchestrator";
import {
  createHelpFlex,
  createSearchResultsFlex,
  createStockInfoFlex,
  createStatsFlex,
  createNotFoundFlex,
} from "@/lib/line-chat/flex-messages";

// Bot name สำหรับ group mention detection
// ใช้ environment variable หรือ fallback เป็นค่า default
const BOT_MENTION = process.env.LINE_BOT_NAME || "@SpareBot";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    if (!signature) {
      return NextResponse.json({ message: "Missing signature" }, { status: 401 });
    }

    if (!verifyLineSignature(body, signature)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    const parsed = JSON.parse(body) as LineWebhookBody;
    const events = parsed.events || [];

    for (const event of events) {
      // Process only message events
      if (event.type !== "message") continue;

      const replyToken = event.replyToken;
      if (!replyToken) continue;

      const source = event.source;
      const isGroup = source?.type === "group";
      const lineUserId = source?.userId;
      const lineGroupId = isGroup ? source?.groupId : undefined;

      // Handle image messages (Phase 2 - placeholder)
      if (event.message?.type === "image") {
        // Group chat: only respond if @mentioned
        if (isGroup) {
          const rawText = event.message?.text || "";
          if (!rawText.includes(BOT_MENTION)) continue;
        }
        await sendLineReply(replyToken, [
          createTextMessage("📷 ฟีเจอร์ค้นหาด้วยรูปภาพจะเปิดให้ใช้เร็วๆ นี้!"),
        ]);
        continue;
      }

      // Skip non-text messages (sticker, video, audio, location, etc.)
      if (event.message?.type !== "text") continue;

      const rawText = (event.message?.text || "").trim();
      if (!rawText) continue;

      // Group chat: only respond if @mentioned
      if (isGroup) {
        if (!rawText.includes(BOT_MENTION)) {
          // Not mentioned, skip
          continue;
        }
      }

      // Get user's linked account
      const user = lineUserId
        ? await prisma.user.findUnique({ where: { lineUserId } })
        : null;

      if (isGroup && !lineUserId) {
        await sendLineReply(replyToken, [
          createTextMessage("ไม่สามารถระบุตัวตนผู้ใช้ในกลุ่มนี้ได้ กรุณา link account ผ่าน LIFF ก่อนใช้งาน"),
        ]);
        continue;
      }

      // If user not linked and trying to use AI features, suggest linking
      if (!user && isGroup) {
        await sendLineReply(replyToken, [
          createTextMessage(
            "คุณยังไม่ได้ link account กับระบบ\nกรุณา link ผ่าน LIFF: https://liff.line.me/..."
          ),
        ]);
        continue;
      }

      // Strip @mention from text for processing
      const text = isGroup
        ? rawText.replace(new RegExp(BOT_MENTION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").trim()
        : rawText;

      if (!text) {
        // Only @mention, no actual message - show help only in 1-on-1
        if (!isGroup) {
          await sendLineReply(replyToken, [createFlexMessage("ผู้ช่วยสต็อก", createHelpFlex())]);
        }
        continue;
      }

      // Check for legacy commands (backward compatibility)
      const legacyReply = await tryLegacyCommand(text, replyToken);
      if (legacyReply) continue;

      // Use AI orchestrator for all other messages
      try {
        const userId = user?.id || "anonymous";
        const result = await orchestrate(userId, lineGroupId, text, isGroup || false);

        // Try to format as Flex Message if possible
        const flexReply = await tryFormatAsFlex(result.reply, text);
        if (flexReply) {
          await sendLineReply(replyToken, [flexReply]);
        } else {
          await sendLineReply(replyToken, [createTextMessage(result.reply)]);
        }
      } catch (error) {
        console.error("Orchestrator error:", error);
        await sendLineReply(replyToken, [
          createTextMessage("ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"),
        ]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Legacy command support (backward compatibility)
async function tryLegacyCommand(text: string, replyToken: string): Promise<boolean> {
  const command = text.toLowerCase();

  // stock <code>
  const stockMatch = text.match(/^stock\s+(.+)$/i);
  if (stockMatch) {
    const part = await resolvePartFromCode(stockMatch[1].trim());
    if (part) {
      await sendLineReply(replyToken, [
        createFlexMessage(`สต็อก ${part.partNumber}`, createStockInfoFlex(part)),
      ]);
    } else {
      await sendLineReply(replyToken, [
        createFlexMessage("ไม่พบ", createNotFoundFlex(stockMatch[1].trim())),
      ]);
    }
    return true;
  }

  // search <keyword>
  const searchMatch = text.match(/^(?:ค้นหา|search)\s+(.+)$/i);
  if (searchMatch) {
    const keyword = searchMatch[1].trim();
    const parts = await prisma.part.findMany({
      where: {
        isActive: true,
        OR: [
          { partNumber: { contains: keyword } },
          { partName: { contains: keyword } },
        ],
      },
      include: {
        category: { select: { name: true } },
        building: { select: { name: true } },
      },
      take: 5,
      orderBy: { partNumber: "asc" },
    });

    await sendLineReply(replyToken, [
      createFlexMessage(`ค้นหา ${keyword}`, createSearchResultsFlex(keyword, parts)),
    ]);
    return true;
  }

  // help
  if (command === "help" || command === "ช่วยเหลือ") {
    await sendLineReply(replyToken, [createFlexMessage("วิธีใช้", createHelpFlex())]);
    return true;
  }

  return false;
}

// Try to format orchestrator reply as Flex Message
async function tryFormatAsFlex(reply: string, originalText: string) {
  // If reply contains stock info pattern, try to format as Flex
  const stockMatch = reply.match(/📦\s*(\S+)\s*-\s*(.+)/);
  if (stockMatch) {
    const partNumber = stockMatch[1];
    const part = await prisma.part.findFirst({
      where: { partNumber, isActive: true },
      include: { category: { select: { name: true } }, building: { select: { name: true } } },
    });
    if (part) {
      return createFlexMessage(`สต็อก ${partNumber}`, createStockInfoFlex(part));
    }
  }

  // If reply mentions "สรุปสต็อก" or stats, try to format as Flex
  if (reply.includes("📊 สรุปสต็อก") || originalText.includes("สรุปสต็อก")) {
    try {
      const { getStorageSummary } = await import("@/lib/storage-summary");
      const stats = await getStorageSummary();
      return createFlexMessage("สรุปสต็อก", createStatsFlex(stats));
    } catch {
      // Fallback to text
    }
  }

  return null;
}
