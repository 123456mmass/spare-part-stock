import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePartFromCode } from "@/lib/part-lookup";
import {
  verifyLineSignature,
  sendLineReply,
  getLineMessageContent,
  createTextMessage,
  createFlexMessage,
  type LineWebhookBody,
} from "@/lib/line";
import { orchestrate } from "@/lib/line-chat/orchestrator";
import { parseLineInventoryQuery, searchPartsForLine } from "@/lib/line-chat/tools";
import { suggestPartFromImage } from "@/lib/part-ai";
import {
  createHelpFlex,
  createLoginRequiredFlex,
  createSearchResultsFlex,
  createStockInfoFlex,
  createStatsFlex,
  createNotFoundFlex,
} from "@/lib/line-chat/flex-messages";

// Bot name สำหรับ group mention detection
// ใช้ environment variable หรือ fallback เป็นค่า default
const BOT_MENTION = process.env.LINE_BOT_NAME || "@SpareBot";

function isMenuRequest(text: string): boolean {
  return /^(สวัสดี|หวัดดี|hello|hi|help|ช่วยเหลือ|เมนู|menu|เริ่มต้น)$/i.test(text.trim());
}

async function findLineLinkedUser(lineUserId?: string) {
  if (!lineUserId) return null;

  const linked = await prisma.lineAccount.findUnique({
    where: { lineUserId },
    include: { user: true },
  });
  if (linked?.user) return linked.user;

  return prisma.user.findUnique({ where: { lineUserId } });
}

async function searchPartsFromImage(imageBuffer: Buffer) {
  const fileBuffer = imageBuffer.buffer.slice(
    imageBuffer.byteOffset,
    imageBuffer.byteOffset + imageBuffer.byteLength
  ) as ArrayBuffer;
  const file = new File([fileBuffer], "line-image.jpg", { type: "image/jpeg" });
  const suggestion = await suggestPartFromImage(file);
  const keywords = [
    suggestion.partNumber,
    suggestion.partName,
    suggestion.subcategory,
    suggestion.categoryName,
    suggestion.description,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const seen = new Set<string>();
  const results = [];
  for (const keyword of keywords) {
    const parts = await searchPartsForLine({ keyword, limit: 10 });
    for (const part of parts) {
      if (!seen.has(part.id)) {
        seen.add(part.id);
        results.push(part);
      }
    }
    if (results.length >= 10) break;
  }

  return {
    keyword: keywords[0] || "รูปภาพ",
    parts: results.slice(0, 10),
  };
}

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
      if (event.type === "follow") {
        if (event.replyToken && event.source?.userId) {
          const linkedUser = await findLineLinkedUser(event.source.userId);
          await sendLineReply(event.replyToken, [
            linkedUser
              ? createFlexMessage("เมนู Spare Part Stock", createHelpFlex())
              : createFlexMessage("เข้าสู่ระบบก่อนใช้งาน", createLoginRequiredFlex()),
          ]);
        }
        continue;
      }

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
        if (isGroup) continue;

        const user = await findLineLinkedUser(lineUserId);

        if (!user) {
          await sendLineReply(replyToken, [
            createFlexMessage("เข้าสู่ระบบก่อนใช้งาน", createLoginRequiredFlex()),
          ]);
          continue;
        }

        try {
          const imageBuffer = await getLineMessageContent(event.message.id);
          const result = await searchPartsFromImage(imageBuffer);
          if (result.parts.length > 0) {
            await sendLineReply(replyToken, [
              createFlexMessage(
                `ค้นหาด้วยรูป ${result.keyword}`,
                createSearchResultsFlex(result.keyword, result.parts)
              ),
            ]);
          } else {
            await sendLineReply(replyToken, [
              createTextMessage("ไม่พบข้อมูลอะไหล่ในสต๊อก"),
            ]);
          }
        } catch (error) {
          console.error("LINE image search error:", error);
          await sendLineReply(replyToken, [
            createTextMessage("ไม่สามารถวิเคราะห์รูปภาพนี้ได้ กรุณาถ่ายให้เห็นตัวอะไหล่หรือรหัสรุ่นชัดขึ้น"),
          ]);
        }
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
      const user = await findLineLinkedUser(lineUserId);

      if (!user) {
        await sendLineReply(replyToken, [
          createFlexMessage("เข้าสู่ระบบก่อนใช้งาน", createLoginRequiredFlex()),
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

      if (isMenuRequest(text)) {
        await sendLineReply(replyToken, [
          createFlexMessage("เมนู Spare Part Stock", createHelpFlex()),
        ]);
        continue;
      }

      const inventoryQuery = parseLineInventoryQuery(text);
      if (inventoryQuery) {
        const parts = await searchPartsForLine({ ...inventoryQuery, limit: 10 });
        await sendLineReply(replyToken, [
          createFlexMessage(
            parts.length > 0 ? `ค้นหา ${inventoryQuery.keyword}` : "ไม่พบอะไหล่",
            createSearchResultsFlex(inventoryQuery.keyword, parts)
          ),
        ]);
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
