import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyLineSignature,
  sendLineReply,
  pushLineMessage,
  getLineMessageContent,
  createTextMessage,
  createFlexMessage,
  type LineWebhookBody,
} from "@/lib/line";
import { orchestrate } from "@/lib/line-chat/orchestrator";
import { searchPartsByImageForLine, searchPartsForLine } from "@/lib/line-chat/tools";
import { buildAssistantMessages } from "@/lib/line-chat/response-builder";
import {
  cancelPendingActionByCode,
  confirmPendingActionByCode,
  createImageSession,
  getImageSession,
  updateImageSessionSuggestion,
  acquireImageSessionProcessing,
  releaseImageSessionProcessing,
  clearImageSession,
  setImageSessionStatus,
} from "@/lib/ai-assistant/pending-actions";
import { suggestPartFromImage } from "@/lib/part-ai";
import { generatePartBarcodeValue } from "@/lib/barcode";
import { listBuildings, resolveBuildingIdByName } from "@/lib/buildings";
import { RateLimitError, rateLimitKey } from "@/lib/rate-limit";
import {
  checkLinePermission,
  getActionLabel,
  type LineAction,
  type LinePermissionDenied,
} from "@/lib/line-permissions";
import {
  getOrCreateConversation,
  saveMessage,
  cleanupOldMessages,
} from "@/lib/line-chat/memory";
import {
  isBotMentioned,
  stripMentionText,
} from "@/lib/line-chat/mentions";
import {
  storeGroupImage,
  findRecentImageForUser,
  findRecentImagesInGroup,
} from "@/lib/group-context";
import {
  createHelpFlex,
  createLoginRequiredFlex,
  createLoginRequiredForActionFlex,
  createSearchResultsFlex,
  createImageIntentFlex,
  createAddPreviewFlex,
  createAddSuccessFlex,
  createWebSearchOfferFlex,
  createWebSearchResultsFlex,
  createImageSelectionFlex,
  type FlexPart,
  type AddPreviewSuggestion,
} from "@/lib/line-chat/flex-messages";
// Bot name สำหรับ group mention detection
const BOT_MENTION = process.env.LINE_BOT_NAME || "@SpareBot";

// Pattern สำหรับ reference to recent image ("รูปนี้", "อันนี้", etc.)
const IMAGE_REFERENCE_PATTERN =
  /(?:รูปนี้|รูปเมื่อกี้|อันนี้|ตัวนี้|อะไหล่นี้|รูปที่ส่ง|รูปนั้น|รูปที่แล้ว|รูปเมื่อสักครู่|ภาพนี้|ภาพเมื่อกี้)/i;

function lineRateLimitKey(event: LineWebhookBody["events"][number]): string {
  const source = event.source;
  return [
    source?.type || "unknown",
    source?.userId || source?.groupId || source?.roomId || "anonymous",
  ].join(":");
}

function isGroupContext(sourceType?: string): boolean {
  return sourceType === "group" || sourceType === "room";
}

async function saveGroupContextEvent(
  lineGroupId: string,
  lineUserId: string,
  content: string,
  messageType: "text" | "image" | "postback",
  metadata: Record<string, unknown> = {},
) {
  try {
    const ctx = await getOrCreateConversation(undefined, lineGroupId);
    await saveMessage(ctx.conversationId, "user", content, messageType, {
      groupSenderUserId: lineUserId,
      ...metadata,
    });

    // Lazy threshold prune: only prune when we exceed 120 to reduce DB writes.
    const count = await prisma.conversationMessage.count({
      where: { conversationId: ctx.conversationId },
    });
    if (count > 120) {
      await cleanupOldMessages(ctx.conversationId, 100);
    }
  } catch (error) {
    // Never block the webhook because of context storage.
    console.error("saveGroupContextEvent error:", error);
  }
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

// ── Postback data parsing ─────────────────────────────────────────

function parseAction(data: string): string | null {
  const match = data.match(/action=(\w+)/);
  return match?.[1] || null;
}

function parseSid(data: string): string | null {
  const match = data.match(/[&?]sid=([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

function parseQueryParam(data: string): string | null {
  const match = data.match(/[&?]q=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function parseMsgId(data: string): string | null {
  const match = data.match(/[&?]msgid=([^&]+)/);
  return match?.[1] || null;
}

function parsePlant(data: string): string | null {
  const match = data.match(/[&?]plant=([^&]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

function parseBuilding(data: string): string | null {
  const match = data.match(/[&?]building=([^&]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

// ── Permission gate for postbacks ─────────────────────────────────

/**
 * Check permission and send login-required flex if denied.
 * Returns the user if allowed, null if denied (already sent reply).
 */
async function gatePostback(
  user: { id: string; role: string } | null,
  action: LineAction,
  replyToken: string,
): Promise<{ id: string; role: string } | null> {
  const permUser = user ? { role: user.role as "ADMIN" | "STAFF" } : null;
  const perm = checkLinePermission(permUser, action);
  if (perm.allowed) return user || { id: "anonymous", role: "STAFF" };

  const denied = perm as LinePermissionDenied;
  if (denied.reason === "login_required") {
    await sendLineReply(replyToken, [
      createFlexMessage("ต้องล็อกอินก่อน", createLoginRequiredForActionFlex(getActionLabel(action))),
    ]);
  } else {
    await sendLineReply(replyToken, [
      createTextMessage(`คุณไม่มีสิทธิ์${getActionLabel(action)} (ต้องใช้สิทธิ์ ${denied.requiredRole})`),
    ]);
  }
  return null;
}

// ── Session ownership helper ──────────────────────────────────────

async function requireImageSession(
  sid: string | null,
  userId: string,
  replyToken: string,
  allowCrossUser = false,
) {
  if (!sid) {
    await sendLineReply(replyToken, [
      createTextMessage("ข้อมูลไม่สมบูรณ์ กรุณาส่งรูปใหม่"),
    ]);
    return null;
  }

  let session;
  try {
    session = await getImageSession(sid);
  } catch (error) {
    await sendLineReply(replyToken, [
      createTextMessage(
        error instanceof Error ? error.message : "เซสชันไม่ถูกต้อง กรุณาส่งรูปใหม่",
      ),
    ]);
    return null;
  }

  if (!session) {
    await sendLineReply(replyToken, [
      createTextMessage("ไม่พบเซสชัน กรุณาส่งรูปใหม่"),
    ]);
    return null;
  }

  if (!allowCrossUser && session.userId !== userId) {
    await sendLineReply(replyToken, [
      createTextMessage("คุณไม่มีสิทธิ์ทำรายการนี้ (เซสชันนี้เป็นของผู้ใช้อื่น)"),
    ]);
    return null;
  }

  return session;
}

// ── Main POST handler ─────────────────────────────────────────────

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
      // ── follow event ──
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

      // ── postback events ──
      if (event.type === "postback" && event.postback?.data) {
        const replyToken = event.replyToken;
        if (!replyToken) continue;

        const data = event.postback.data;
        const action = parseAction(data);
        if (!action) continue;

        const sid = parseSid(data);
        const source = event.source;
        const lineUserId = source?.userId;
        const isGroupForPostback = isGroupContext(source?.type);
        const user = await findLineLinkedUser(lineUserId);

        await handlePostback(action, user, replyToken, sid, data, lineUserId, isGroupForPostback);
        continue;
      }

      // ── message events only below ──
      if (event.type !== "message") continue;

      const replyToken = event.replyToken;
      if (!replyToken) continue;

      // Rate limit
      try {
        rateLimitKey(lineRateLimitKey(event), {
          name: "line-webhook",
          maxRequests: 30,
          windowSeconds: 60,
        });
      } catch (error) {
        if (error instanceof RateLimitError) {
          await sendLineReply(replyToken, [
            createTextMessage(`ส่งข้อความเร็วเกินไป กรุณาลองใหม่ใน ${error.retryAfter} วินาที`),
          ]);
          continue;
        }
        throw error;
      }

      const source = event.source;
      const isGroup = isGroupContext(source?.type);
      const lineUserId = source?.userId || "anonymous";
      const lineGroupId = isGroup ? (source?.groupId || source?.roomId) : undefined;
      const botUserId = parsed.destination;

      // ── Image messages ──
      if (event.message?.type === "image") {
        const messageId = event.message.id;

        // GROUP IMAGE: store context silently, only respond if @mentioned
        if (isGroup) {
          // Always store image ref in both GroupImageContext and rolling context.
          if (lineGroupId) {
            await storeGroupImage(lineGroupId, messageId, lineUserId).catch((e) => {
              console.error("storeGroupImage error:", e);
            });
            await saveGroupContextEvent(
              lineGroupId,
              lineUserId,
              "[image]",
              "image",
              { imageMessageId: messageId },
            );
          }

          // Image messages have no text, so a standalone group image is never replied to.
          // The user must send text + @bot referencing the image.
          continue;
        }

        // 1:1 IMAGE: linked users only
        const user = await findLineLinkedUser(lineUserId);
        if (!user) {
          await sendLineReply(replyToken, [
            createFlexMessage("เข้าสู่ระบบก่อนใช้งาน", createLoginRequiredFlex()),
          ]);
          continue;
        }

        try {
          const imageBuffer = await getLineMessageContent(messageId);
          const imageBase64 = imageBuffer.toString("base64");
          const sessionOwnerId = user.id;
          const sessionId = await createImageSession(sessionOwnerId, imageBase64, messageId);
          await sendLineReply(replyToken, [
            createFlexMessage("จัดการรูปภาพ", createImageIntentFlex(sessionId)),
          ]);
        } catch (error) {
          console.error("LINE image session error:", error);
          await sendLineReply(replyToken, [
            createTextMessage("ไม่สามารถรับรูปภาพได้ กรุณาลองใหม่อีกครั้ง"),
          ]);
        }
        continue;
      }

      // ── Text messages ──
      if (event.message?.type !== "text") continue;

      const rawText = (event.message?.text || "").trim();
      if (!rawText) continue;

      // ── Group text routing ──
      if (isGroup) {
        // Always store rolling context for group text, even without @bot.
        if (lineGroupId) {
          await saveGroupContextEvent(lineGroupId, lineUserId, rawText, "text");
        }

        if (!isBotMentioned(event, rawText, BOT_MENTION, botUserId)) {
          // Not mentioned → never reply, but context is already saved.
          continue;
        }
      }

      // Strip @mention
      const text = isGroup ? stripMentionText(rawText, event, BOT_MENTION) : rawText;

      if (!text) {
        // Only @mention, no message — show help only in 1:1
        if (!isGroup) {
          await sendLineReply(replyToken, [createFlexMessage("ผู้ช่วยสต็อก", createHelpFlex())]);
        }
        continue;
      }

      // ── Get user ──
      const user = await findLineLinkedUser(lineUserId);

      // 1:1: anonymous users must login before anything
      if (!isGroup && !user) {
        await sendLineReply(replyToken, [
          createFlexMessage("เข้าสู่ระบบก่อนใช้งาน", createLoginRequiredFlex()),
        ]);
        continue;
      }

      // Explicit confirmation/cancel codes are handled deterministically
      // (fast, avoids LLM latency, and prevents accidental mutations).
      const pendingCmd = parsePendingActionCommand(text);
      if (pendingCmd) {
        await handleTextPendingAction(pendingCmd, user, replyToken);
        continue;
      }

      // ── Resolve "รูปนี้" / "อันนี้" references in groups ──
      if (isGroup && lineGroupId && IMAGE_REFERENCE_PATTERN.test(text)) {
        const resolved = await resolveImageReference(lineGroupId, lineUserId, replyToken, user);
        if (resolved === "selection_sent") continue;
        if (resolved === "not_found") continue;
        if (resolved === "searched") continue;
        if (resolved && typeof resolved === "object") {
          await sendLineReply(replyToken, [
            createFlexMessage("จัดการรูปภาพ", createImageIntentFlex(resolved.sessionId)),
          ]);
          continue;
        }
      }

      // ── LLM brain: route everything else through the orchestrator ──
      try {
        const userId = user?.id || "anonymous";
        const userRole = user?.role || "STAFF";
        // For group @bot messages, the webhook already saved the user message
        // to rolling context. Skip duplicate save in the orchestrator.
        const skipSaveUserMessage = isGroup;
        const result = await orchestrate(userId, lineGroupId, text, isGroup || false, userRole, lineUserId, skipSaveUserMessage);

        await sendLineReply(replyToken, buildAssistantMessages(result));
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

// ── Inline image search for unlinked group users ──────────────────

/** Search an image directly without creating a session. Used when an unlinked
 *  group user references "รูปนี้" / "อันนี้" — they can search but not add. */
async function inlineImageSearch(
  imageMessageId: string,
  replyToken: string,
): Promise<"searched" | "not_found"> {
  try {
    const imageBuffer = await getLineMessageContent(imageMessageId);
    const imageBase64 = imageBuffer.toString("base64");
    const result = await searchPartsByImageForLine(imageBase64);
    if (result.parts.length === 0) {
      await sendLineReply(replyToken, [
        createTextMessage("🔍 ไม่พบอะไหล่ที่ตรงกับรูปนี้ในคลัง"),
      ]);
      return "searched";
    }
    const flex = createSearchResultsFlex(result.keyword || "image", result.parts as FlexPart[]);
    await sendLineReply(replyToken, [
      createFlexMessage(`ผลค้นหารูป: ${result.keyword || "image"}`, flex),
    ]);
    return "searched";
  } catch {
    await sendLineReply(replyToken, [
      createTextMessage("ไม่สามารถโหลดรูปได้ รูปอาจหมดอายุแล้ว กรุณาส่งรูปใหม่"),
    ]);
    return "not_found";
  }
}

// ── Image reference resolution for groups ─────────────────────────

async function resolveImageReference(
  lineGroupId: string,
  lineUserId: string | undefined,
  replyToken: string,
  linkedUser: { id: string } | null,
): Promise<{ imageBase64: string; sessionId: string } | "selection_sent" | "not_found" | "searched" | null> {
  // Priority 1: recent image by the same user
  if (lineUserId) {
    const userImage = await findRecentImageForUser(lineGroupId, lineUserId);
    if (userImage) {
      // Unlinked group users get inline search — no session needed.
      if (!linkedUser) {
        return await inlineImageSearch(userImage.imageMessageId, replyToken);
      }
      try {
        const imageBuffer = await getLineMessageContent(userImage.imageMessageId);
        const imageBase64 = imageBuffer.toString("base64");
        const sessionId = await createImageSession(linkedUser.id, imageBase64, userImage.imageMessageId);
        return { imageBase64, sessionId };
      } catch {
        // Fall through to group-wide search
      }
    }
  }

  // Priority 2: recent images in group (may need selection)
  const recentImages = await findRecentImagesInGroup(lineGroupId, 4);
  if (recentImages.length === 0) {
    await sendLineReply(replyToken, [
      createTextMessage("ไม่พบรูปล่าสุดในกลุ่ม กรุณาส่งรูปพร้อม @bot อีกครั้ง"),
    ]);
    return "not_found";
  }

  if (recentImages.length === 1) {
    // Unlinked group users get inline search.
    if (!linkedUser) {
      return await inlineImageSearch(recentImages[0].imageMessageId, replyToken);
    }
    try {
      const imageBuffer = await getLineMessageContent(recentImages[0].imageMessageId);
      const imageBase64 = imageBuffer.toString("base64");
      const sessionId = await createImageSession(
        linkedUser.id,
        imageBase64,
        recentImages[0].imageMessageId,
      );
      return { imageBase64, sessionId };
    } catch {
      await sendLineReply(replyToken, [
        createTextMessage("ไม่สามารถโหลดรูปได้ กรุณาส่งรูปใหม่"),
      ]);
      return "not_found";
    }
  }

  // Multiple images → send selection flex
  const selectable = recentImages.map((img) => ({
    messageId: img.imageMessageId,
    senderName: img.senderUserId.slice(0, 8),
    timestamp: new Date(img.createdAt).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  await sendLineReply(replyToken, [
    createFlexMessage("เลือกรูป", createImageSelectionFlex(selectable)),
  ]);
  return "selection_sent";
}

function parsePendingActionCommand(text: string): { action: "confirm" | "cancel"; code: string } | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(ยืนยัน|confirm|ok|ตกลง|ยกเลิก|cancel)\s+([a-z0-9]{4,12})$/i);
  if (!match) return null;
  return {
    action: /^(ยกเลิก|cancel)$/i.test(match[1]) ? "cancel" : "confirm",
    code: match[2],
  };
}

// ── Text pending action handler ────────────────────────────────────

async function handleTextPendingAction(
  cmd: { action: "confirm" | "cancel"; code: string },
  user: { id: string; role: string } | null,
  replyToken: string,
) {
  if (!user) {
    await sendLineReply(replyToken, [
      createFlexMessage("ต้องล็อกอินก่อน", createLoginRequiredFlex()),
    ]);
    return;
  }

  try {
    const result =
      cmd.action === "confirm"
        ? await confirmPendingActionByCode(user.id, cmd.code)
        : { message: `ยกเลิกรายการแล้ว`, action: await cancelPendingActionByCode(user.id, cmd.code) };
    await sendLineReply(replyToken, [createTextMessage(result.message || "ทำรายการสำเร็จ")]);
  } catch (error) {
    await sendLineReply(replyToken, [
      createTextMessage(error instanceof Error ? error.message : "ไม่สามารถทำรายการได้"),
    ]);
  }
}

// ── Postback handler ───────────────────────────────────────────────

async function handlePostback(
  action: string,
  user: { id: string; role: string } | null,
  replyToken: string,
  sid: string | null,
  data: string,
  lineUserId: string | undefined,
  isGroup: boolean,
) {
  try {
    switch (action) {
      // ── Read-only: anonymous allowed in groups, linked required in 1:1 ──
      case "part_image_search": {
        if (isGroup) {
          // Anonymous users may search by image in groups.
          await handlePartImageSearch(user?.id || "anonymous", replyToken, sid, lineUserId);
          break;
        }
        const gated = await gatePostback(user, "image_search", replyToken);
        if (!gated) return;
        await handlePartImageSearch(gated.id, replyToken, sid, lineUserId);
        break;
      }

      // ── Write: linked users allowed ──
      case "part_image_add": {
        const gated = await gatePostback(user, "create_part", replyToken);
        if (!gated) return;
        await handlePartImageAdd(gated.id, replyToken, sid, lineUserId);
        break;
      }
      case "part_add_confirm": {
        const gated = await gatePostback(user, "confirm_ai_add", replyToken);
        if (!gated) return;
        await handlePartAddConfirm(gated.id, replyToken, sid, lineUserId);
        break;
      }
      case "part_add_set_plant": {
        const gated = await gatePostback(user, "edit_ai_suggestion", replyToken);
        if (!gated) return;
        await handlePartAddSetPlant(gated.id, replyToken, sid, data, lineUserId);
        break;
      }
      case "part_add_set_building": {
        const gated = await gatePostback(user, "edit_ai_suggestion", replyToken);
        if (!gated) return;
        await handlePartAddSetBuilding(gated.id, replyToken, sid, data, lineUserId);
        break;
      }
      case "part_add_retry": {
        const gated = await gatePostback(user, "create_part", replyToken);
        if (!gated) return;
        // Preserve existing plant/building if already selected
        let preserveLocation: { plant?: string; buildingId?: string; buildingName?: string } | undefined;
        if (sid) {
          try {
            const retrySession = await getImageSession(sid);
            if (retrySession?.suggestionJson) {
              const rs = retrySession.suggestionJson as Record<string, unknown>;
              if (rs.plant || rs.buildingId) {
                preserveLocation = {
                  plant: String(rs.plant || ""),
                  buildingId: String(rs.buildingId || ""),
                  buildingName: String(rs.buildingName || ""),
                };
              }
            }
          } catch { /* ignore — proceed without preserving */ }
        }
        await handlePartImageAdd(gated.id, replyToken, sid, lineUserId, preserveLocation);
        break;
      }

      // ── Cancel: session owner only ──
      case "part_add_cancel": {
        // Validate session ownership before clearing
        // Anonymous sessions use lineUserId (or "anonymous" as fallback)
        const effectiveUserId = user?.id || lineUserId || "anonymous";
        if (!sid) {
          await sendLineReply(replyToken, [createTextMessage("ยกเลิกแล้ว")]);
          return;
        }
        let cancelSession;
        try { cancelSession = await getImageSession(sid); } catch { /* ignore */ }
        if (cancelSession && cancelSession.userId !== effectiveUserId) {
          await sendLineReply(replyToken, [
            createTextMessage("คุณไม่มีสิทธิ์ทำรายการนี้"),
          ]);
          return;
        }
        try { await clearImageSession(sid); } catch { /* ok */ }
        await sendLineReply(replyToken, [
          createTextMessage("ยกเลิกการเพิ่มอะไหล่แล้ว ส่งรูปใหม่เมื่อต้องการ"),
        ]);
        break;
      }

      // ── Web search: anonymous allowed in groups / read-only ──
      case "part_web_search": {
        if (!isGroup) {
          const gated = await gatePostback(user, "search_parts", replyToken);
          if (!gated) return;
        }
        const q = parseQueryParam(data) || "unknown";
        await handlePartWebSearch(q, replyToken);
        break;
      }
      case "search_cancel": {
        await sendLineReply(replyToken, [createTextMessage("ยกเลิกการค้นหา")]);
        break;
      }

      // ── Image selection from group context ──
      case "select_image": {
        const msgId = parseMsgId(data);
        if (!msgId) {
          await sendLineReply(replyToken, [createTextMessage("ข้อมูลไม่สมบูรณ์")]);
          return;
        }
        if (!lineUserId) {
          await sendLineReply(replyToken, [
            createTextMessage("ไม่สามารถระบุตัวตนผู้ส่งรูปได้ กรุณาเปิดการแชร์โปรไฟล์ในกลุ่ม"),
          ]);
          return;
        }
        // Unlinked group user: inline image search only (no session needed).
        if (isGroup && !user) {
          await inlineImageSearch(msgId, replyToken);
          break;
        }
        // Require linked user in 1:1 or for full session (search + add).
        if (!user) {
          await sendLineReply(replyToken, [
            createTextMessage("ต้องล็อกอินก่อน กรุณาลิงก์บัญชี LINE"),
          ]);
          return;
        }
        await handleSelectImage(msgId, user.id, replyToken);
        break;
      }
      case "image_select_cancel": {
        await sendLineReply(replyToken, [createTextMessage("ยกเลิกการเลือกรูป")]);
        break;
      }

      default:
        await sendLineReply(replyToken, [
          createTextMessage("ไม่รู้จักคำสั่งนี้ กรุณาลองใหม่"),
        ]);
    }
  } catch (error) {
    console.error(`Postback ${action} error:`, error);
    await sendLineReply(replyToken, [
      createTextMessage(
        error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่",
      ),
    ]);
  }
}

// Placeholder: use userId from event source (postback events carry source.userId)
// This function exists as an explicit boundary marker for future session ownership checks

// ── Part image search handler ──────────────────────────────────────

async function handlePartImageSearch(
  userId: string,
  replyToken: string,
  sid: string | null,
  pushTarget?: string,
) {
  // Allow cross-user for read-only search
  const session = await requireImageSession(sid, userId, replyToken, true);
  if (!session) return;

  const locked = await acquireImageSessionProcessing(session.id, "part_image_search");
  if (!locked) {
    await sendLineReply(replyToken, [
      createTextMessage("กำลังประมวลผลรูปนี้อยู่ครับ รอสักครู่ ผลลัพธ์จะตามมาในแชทนี้"),
    ]);
    return;
  }

  // Only send progress if we have pushTarget available for the final result.
  // replyToken can only be used once, so when pushTarget is absent we skip
  // the progress message and reply with results directly.
  if (pushTarget) {
    await sendLineReply(replyToken, [
      createTextMessage("กำลังค้นหาอะไหล่จากรูปด้วย AI ครับ รอสักครู่..."),
    ]);
  }

  try {
    let result = await searchPartsByImageForLine(session.imageBase64);
    if (result.parts.length === 0) {
      const buffer = Buffer.from(session.imageBase64, "base64");
      const file = new File([buffer], "line-image.jpg", { type: "image/jpeg" });
      try {
        const suggestion = await suggestPartFromImage(file);
        const keywords = [
          suggestion.partNumber,
          suggestion.partName,
          suggestion.subcategory,
        ].filter((v): v is string => Boolean(v?.trim()));
        const keyword = keywords[0] || "รูปภาพ";
        const parts = await searchPartsForLine({ keyword, limit: 10 });
        result = { keyword, parts };
      } catch {
        // Already empty
      }
    }

    if (result.parts.length === 0) {
      const visionKeyword = result.keyword || "รูปภาพ";
      await pushOrReply(pushTarget, replyToken, [
        createFlexMessage(`ไม่พบ "${visionKeyword}"`, createWebSearchOfferFlex(visionKeyword)),
        createTextMessage(`ไม่พบอะไหล่ที่ตรงกับรูปนี้ กด "ค้นเว็บ" เพื่อค้นหาจากแหล่งข้อมูลภายนอก`),
      ]);
      await releaseImageSessionProcessing(session.id);
      return;
    }

    await pushOrReply(pushTarget, replyToken, [
      createFlexMessage(`ผลค้นหาจาก${result.keyword}`, createSearchResultsFlex(result.keyword, result.parts)),
    ]);

    await clearImageSession(session.id);
  } catch (error) {
    await releaseImageSessionProcessing(session.id);
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage(error instanceof Error ? error.message : "ค้นหาจากรูปไม่สำเร็จ กรุณาลองใหม่"),
    ]);
  }
}

async function listBuildingsForFlex(): Promise<Array<{ id: string; name: string }>> {
  const buildings = await listBuildings();
  return buildings.map((b) => ({ id: b.id, name: b.name }));
}

async function pushOrReply(
  pushTarget: string | undefined,
  replyToken: string,
  messages: Parameters<typeof sendLineReply>[1],
) {
  if (pushTarget) {
    await pushLineMessage(pushTarget, messages);
    return;
  }
  await sendLineReply(replyToken, messages);
}

// ── Part image add handler ─────────────────────────────────────────

async function handlePartImageAdd(
  userId: string,
  replyToken: string,
  sid: string | null,
  pushTarget?: string,
  _preserveLocation?: { plant?: string; buildingId?: string; buildingName?: string },
) {
  const session = await requireImageSession(sid, userId, replyToken);
  if (!session) return;

  // Open the LIFF add-part page using LIFF deep link (liff.line.me/ID/path)
  // so LINE opens it in the LIFF in-app browser, NOT external browser.
  // Web URLs (spare.birdsphichitchai.dev/liff/...) cause LIFF SDK to fail.
  // LIFF endpoint is https://spare.birdsphichitchai.dev/liff, so
  // liff.line.me/{ID}/add-part maps to /liff/add-part (NOT /liff/liff/add-part).
  const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || "2010187689-ZCU84P4L";
  const liffUrl = `https://liff.line.me/${LIFF_ID}/add-part?lineSid=${encodeURIComponent(session.id)}`;

  await pushOrReply(pushTarget, replyToken, [
    {
      type: "template",
      altText: "เพิ่มอะไหล่ใหม่จากรูป",
      template: {
        type: "buttons",
        text: "📸 กดปุ่มด้านล่างเพื่อเพิ่มอะไหล่\nระบบจะวิเคราะห์รูปและกรอกข้อมูลให้อัตโนมัติ",
        actions: [
          {
            type: "uri",
            label: "➕ เพิ่มอะไหล่ใหม่",
            uri: liffUrl,
          },
        ],
      },
    },
  ]);
}

// ── Part add confirm handler ───────────────────────────────────────

async function handlePartAddConfirm(userId: string, replyToken: string, sid: string | null, pushTarget?: string) {
  const session = await requireImageSession(sid, userId, replyToken);
  if (!session) return;

  if (!session.suggestionJson) {
    await sendLineReply(replyToken, [
      createTextMessage("ไม่พบข้อมูลพรีวิว กรุณาลองวิเคราะห์รูปใหม่"),
    ]);
    return;
  }

  const s = session.suggestionJson as Record<string, unknown>;
  const currentStatus = (s.status as string) || "";

  // Idempotency: already saved — report the created part
  if (currentStatus === "saved" && s.createdPartId) {
    const partNumber = String(s.partNumber || "");
    const partName = String(s.partName || "");
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage(`✅ บันทึกแล้วไม่ต้องกดซ้ำ — ${partNumber}: ${partName}`),
    ]);
    return;
  }

  // Idempotency: currently saving
  if (currentStatus === "saving") {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("⏳ กำลังดำเนินการบันทึก กรุณารอสักครู่..."),
    ]);
    return;
  }

  const plant = String(s.plant || "").trim();
  const buildingId = String(s.buildingId || "").trim();

  // Missing plant/building: reply preview flex with selector + warning
  if (!plant || !buildingId) {
    const buildings = await listBuildingsForFlex();
    await pushOrReply(pushTarget, replyToken, [
      createFlexMessage("พรีวิว", createAddPreviewFlex(
        s as unknown as AddPreviewSuggestion, session.id, buildings,
      )),
      createTextMessage("⚠️ กรุณาเลือก Block และอาคารก่อนยืนยัน กดปุ่มด้านล่างเพื่อเลือก"),
    ]);
    return;
  }

  // Acquire processing lock to prevent concurrent confirm
  const locked = await acquireImageSessionProcessing(session.id, "part_add_confirm");
  if (!locked) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("⏳ กำลังดำเนินการอยู่ กรุณารอสักครู่..."),
    ]);
    return;
  }

  try {
    // Re-read session after acquiring lock (in case it was modified)
    const freshSession = await getImageSession(session.id);
    if (!freshSession?.suggestionJson) {
      await releaseImageSessionProcessing(session.id);
      await pushOrReply(pushTarget, replyToken, [
        createTextMessage("ไม่พบข้อมูลพรีวิว กรุณาลองวิเคราะห์รูปใหม่"),
      ]);
      return;
    }

    const fs = freshSession.suggestionJson as Record<string, unknown>;
    const freshStatus = (fs.status as string) || "";

    // Double-check idempotency after lock
    if (freshStatus === "saved" && fs.createdPartId) {
      await releaseImageSessionProcessing(session.id);
      const partNumber = String(fs.partNumber || "");
      const partName = String(fs.partName || "");
      await pushOrReply(pushTarget, replyToken, [
        createTextMessage(`✅ บันทึกแล้วไม่ต้องกดซ้ำ — ${partNumber}: ${partName}`),
      ]);
      return;
    }

    const partNumber = String(fs.partNumber || "");
    const partName = String(fs.partName || "Unknown - Spare Part");

    // Set status to saving
    await setImageSessionStatus(session.id, "saving");

    const existing = await prisma.part.findUnique({ where: { partNumber } });
    if (existing) {
      // Already exists — mark as saved with the existing partId
      await updateImageSessionSuggestion(session.id, {
        ...fs,
        status: "saved",
        createdPartId: existing.id,
      });
      await releaseImageSessionProcessing(session.id);
      await pushOrReply(pushTarget, replyToken, [
        createTextMessage(`รหัส ${partNumber} มีในระบบแล้ว: ${existing.partName}`),
      ]);
      await clearImageSession(session.id);
      return;
    }

    let categoryId: string | null = (fs.categoryId as string) || null;
    const categoryName = String(fs.categoryName || "").trim();
    if (!categoryId && categoryName) {
      const cat = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });
      categoryId = cat.id;
    }

    const newPart = await prisma.part.create({
      data: {
        partNumber,
        partName,
        description: String(fs.description || ""),
        categoryId,
        subcategory: String(fs.subcategory || ""),
        plant,
        buildingId,
        location: String(fs.location || ""),
        quantity: Number(fs.quantity ?? 1),
        minimumQuantity: Number(fs.minimumQuantity ?? 1),
        unit: String(fs.unit || "pcs"),
        barcodeValue: String(fs.barcodeValue || "").trim() || generatePartBarcodeValue(partNumber),
        createdBy: userId,
      },
    });

    // Mark as saved with the created partId
    await updateImageSessionSuggestion(session.id, {
      ...fs,
      status: "saved",
      createdPartId: newPart.id,
    });
    await releaseImageSessionProcessing(session.id);
    await clearImageSession(session.id);
    await pushOrReply(pushTarget, replyToken, [
      createFlexMessage("เพิ่มสำเร็จ", createAddSuccessFlex(partNumber, partName)),
    ]);
  } catch (error) {
    await releaseImageSessionProcessing(session.id);
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่"),
    ]);
  }
}

// ── Part add set plant handler ──────────────────────────────────────

async function handlePartAddSetPlant(
  userId: string,
  replyToken: string,
  sid: string | null,
  data: string,
  pushTarget?: string,
) {
  const session = await requireImageSession(sid, userId, replyToken);
  if (!session) return;

  if (!session.suggestionJson) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("ไม่พบข้อมูลพรีวิว กรุณาลองวิเคราะห์รูปใหม่"),
    ]);
    return;
  }

  const plant = parsePlant(data);
  if (!plant) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("ข้อมูลไม่สมบูรณ์ กรุณาลองใหม่"),
    ]);
    return;
  }

  const suggestion = { ...session.suggestionJson, plant };
  await updateImageSessionSuggestion(session.id, suggestion);

  const buildings = await listBuildingsForFlex();
  await pushOrReply(pushTarget, replyToken, [
    createFlexMessage("พรีวิว", createAddPreviewFlex(
      suggestion as unknown as AddPreviewSuggestion, session.id, buildings,
    )),
  ]);
}

// ── Part add set building handler ──────────────────────────────────

async function handlePartAddSetBuilding(
  userId: string,
  replyToken: string,
  sid: string | null,
  data: string,
  pushTarget?: string,
) {
  const session = await requireImageSession(sid, userId, replyToken);
  if (!session) return;

  if (!session.suggestionJson) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("ไม่พบข้อมูลพรีวิว กรุณาลองวิเคราะห์รูปใหม่"),
    ]);
    return;
  }

  const buildingName = parseBuilding(data);
  if (!buildingName) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage("ข้อมูลไม่สมบูรณ์ กรุณาลองใหม่"),
    ]);
    return;
  }

  const buildingId = await resolveBuildingIdByName(buildingName);
  if (!buildingId) {
    await pushOrReply(pushTarget, replyToken, [
      createTextMessage(`ไม่พบอาคาร "${buildingName}" ในระบบ`),
    ]);
    return;
  }

  const suggestion = { ...session.suggestionJson, buildingId, buildingName };
  await updateImageSessionSuggestion(session.id, suggestion);

  const buildings = await listBuildingsForFlex();
  await pushOrReply(pushTarget, replyToken, [
    createFlexMessage("พรีวิว", createAddPreviewFlex(
      suggestion as unknown as AddPreviewSuggestion, session.id, buildings,
    )),
  ]);
}

// ── Web search handler ─────────────────────────────────────────────

async function handlePartWebSearch(keyword: string, replyToken: string) {
  try {
    const { searchPartOnWeb } = await import("@/lib/tavily");
    const result = await searchPartOnWeb({ keywords: keyword, maxResults: 5 });

    if (result.results.length === 0) {
      await sendLineReply(replyToken, [
        createFlexMessage("ค้นเว็บ", createWebSearchResultsFlex(keyword, [])),
        createTextMessage(`ไม่พบข้อมูล "${keyword}" จากแหล่งภายนอก`),
      ]);
      return;
    }

    const items = result.results.map((r) => {
      const urlObj = new URL(r.url);
      return {
        title: r.title,
        url: r.url,
        snippet: r.content,
        sourceDomain: urlObj.hostname,
        score: r.score,
      };
    });

    await sendLineReply(replyToken, [
      createFlexMessage(`ผลค้นเว็บ ${keyword}`, createWebSearchResultsFlex(keyword, items)),
      createTextMessage(`🔍 ค้นเว็บ "${keyword}" พบ ${items.length} รายการ`),
    ]);
  } catch (error) {
    console.error("Web search error:", error);
    await sendLineReply(replyToken, [
      createTextMessage(
        error instanceof Error ? error.message : "ค้นเว็บไม่สำเร็จ กรุณาลองใหม่",
      ),
    ]);
  }
}

// ── Select image from group context ────────────────────────────────

async function handleSelectImage(
  messageId: string,
  userId: string,
  replyToken: string,
) {
  try {
    const imageBuffer = await getLineMessageContent(messageId);
    const imageBase64 = imageBuffer.toString("base64");
    const sessionId = await createImageSession(userId, imageBase64, messageId);
    await sendLineReply(replyToken, [
      createFlexMessage("จัดการรูปภาพ", createImageIntentFlex(sessionId)),
    ]);
  } catch {
    await sendLineReply(replyToken, [
      createTextMessage("ไม่สามารถโหลดรูปได้ รูปอาจหมดอายุแล้ว กรุณาส่งรูปใหม่"),
    ]);
  }
}

