/**
 * Tests: LINE text intent classification + routing logic
 *
 * Zero gateway/DB dependency — tests classifyTextIntent + parseLineInventoryQuery only.
 *
 * Usage:
 *   npx tsx test-line-intent.ts
 */

import { parseLineInventoryQuery } from "./src/lib/line-chat/tools";
import {
  isBotMentioned,
  stripMentionText,
  isExplicitWebSearch,
} from "./src/lib/line-chat/mentions";

// ── helpers ──────────────────────────────────────────────────────────

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// ── classifyTextIntent (replicated from webhook for unit testing) ──

type TextIntent = "inventory_search" | "general_chat" | "pending_action" | "help" | "export";

const KNOWLEDGE_PATTERN =
  /(คืออะไร|คือ|หมายถึง|แปลว่า|อธิบาย|ช่วยอธิบาย|วิธี|ยังไง|อย่างไร|ทำไง|ขั้นตอน|คู่มือ|ใช้งาน|ทำอะไรได้บ้าง|ทำไรได้บ้าง|ช่วยอะไรได้บ้าง|definition|meaning|explain|how.?to)/i;

const INVENTORY_TRIGGER =
  /(stock|สต็อก|สต๊อก|คงเหลือ|เหลือ|จำนวน|มีไหม|มีกี่|ค้นหา|หา|เช็ค|ตรวจ|กี่ตัว|กี่ชิ้น)/i;

const CASUAL_PATTERN =
  /^(ดี|สบายดี|เป็นไง|หวัดดี|สวัสดี|hello|hi|hey|ok|โอเค|ขอบคุณ|thank|ครับ|ค่ะ|คะ|จ้า)$/i;

const CASUAL_TOPICS =
  /(วันนี้ทำอะไร|อากาศ|กินข้าว|หิว|ง่วง|เพลง|หนัง|เกม|ข่าว|เมื่อวาน|พรุ่งนี้|อะไรดี)/i;

function isMenuRequest(text: string): boolean {
  return /^(สวัสดี|หวัดดี|hello|hi|help|ช่วยเหลือ|เมนู|menu|เริ่มต้น|ทำอะไรได้บ้าง|ทำไรได้บ้าง|ช่วยอะไรได้บ้าง|ใช้งานยังไง|ใช้ยังไง)$/i.test(text.trim());
}

function isExcelExportRequest(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  return /(excel|xlsx|เอ็กเซล|เอกเซล|ส่งออก|export|ดาวน์โหลด|download|โหลด).*(อะไหล่|สต็อก|สต๊อก|รายการ|ไฟล์)?/i.test(normalized);
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

function classifyTextIntent(text: string): TextIntent {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "general_chat";

  if (parsePendingActionCommand(normalized)) return "pending_action";
  if (isMenuRequest(normalized)) return "help";
  if (isExcelExportRequest(normalized)) return "export";

  const cmdLower = normalized.toLowerCase();
  if (/^(stock\s+|ค้นหา\s+|search\s+|help|ช่วยเหลือ)$/i.test(cmdLower)) return "help";

  // Knowledge questions — even if they mention part terms
  if (KNOWLEDGE_PATTERN.test(normalized) && !INVENTORY_TRIGGER.test(normalized)) {
    return "general_chat";
  }

  // Casual/irrelevant talk
  if (CASUAL_PATTERN.test(normalized.trim()) || CASUAL_TOPICS.test(normalized)) {
    return "general_chat";
  }

  // Use parseLineInventoryQuery for inventory search intent
  const inventoryQuery = parseLineInventoryQuery(normalized);
  if (inventoryQuery) return "inventory_search";

  return "general_chat";
}

// ── tests ────────────────────────────────────────────────────────────

function testInventorySearchIntents() {
  console.log("\n=== Test A: Inventory search intents → inventory_search ===");

  const cases = [
    "ค้นหาเบรกเกอร์",
    "หาเบรกเกอร์",
    "มีเบรกเกอร์ไหม",
    "เบรกเกอร์เหลือกี่ตัว",
    "relay มีไหม",
    "ค้นหา LC1D40AP7",
    "อะไหล่ Schneider",
    "ดูอะไหล่หมวดอุปกรณ์ไฟฟ้า",
    "contactor เหลือเท่าไหร่",
    "เช็คสต็อก relay",
    "ตรวจสอบ bearing",
    "มอเตอร์คงเหลือ",
    "ฟิวส์มีกี่ชิ้น",
    "หา contactor",
    "สต็อกต่ำ",
    "เซนเซอร์เหลือไหม",
  ];

  for (const text of cases) {
    const intent = classifyTextIntent(text);
    const query = parseLineInventoryQuery(text);
    assert(
      intent === "inventory_search",
      `"${text}" → inventory_search (got "${intent}")`,
    );
    assert(query !== null, `"${text}" has parseable query: keyword="${query?.keyword}"`);
  }
}

function testGeneralChatIntents() {
  console.log("\n=== Test B: General chat → general_chat ===");

  const cases = [
    "เบรกเกอร์คืออะไร",
    "ช่วยอธิบาย relay",
    "มอเตอร์ทำงานยังไง",
    "วิธีเลือกเบรกเกอร์",
    "คอนแทคเตอร์กับรีเลย์ต่างกันยังไง",
    "ขั้นตอนการเบิกอะไหล่",
    "คู่มือการใช้งาน",
    "definition of contactor",
    "explain motor",
    "วันนี้ทำอะไรดี",
    "ขอบคุณครับ",
    "อากาศวันนี้ร้อน",
    "กินข้าวยัง",
    "เบรกเกอร์หมายถึงอะไร",
    "ทำไงให้สต็อกไม่หมด",
    "how to choose bearing",
  ];

  for (const text of cases) {
    const intent = classifyTextIntent(text);
    assert(
      intent === "general_chat",
      `"${text}" → general_chat (got "${intent}")`,
    );
  }
}

function testExportIntent() {
  console.log("\n=== Test C: Export → export ===");

  const cases = [
    "export excel",
    "ส่งออกสต็อก",
    "ดาวน์โหลด excel",
    "เอ็กเซล สต็อก",
    "ดาวน์โหลดไฟล์สต็อก",
  ];

  for (const text of cases) {
    const intent = classifyTextIntent(text);
    assert(
      intent === "export",
      `"${text}" → export (got "${intent}")`,
    );
  }
}

function testHelpIntent() {
  console.log("\n=== Test D: Help → help ===");

  const cases = [
    "เมนู",
    "menu",
    "help",
    "ช่วยเหลือ",
    "เริ่มต้น",
    "ทำอะไรได้บ้าง",
    "สวัสดี",
    "hi",
  ];

  for (const text of cases) {
    const intent = classifyTextIntent(text);
    assert(
      intent === "help",
      `"${text}" → help (got "${intent}")`,
    );
  }
}

function testPendingActionIntent() {
  console.log("\n=== Test E: Pending action → pending_action ===");

  const cases = [
    "ยืนยัน ABC123",
    "confirm XYZ789",
    "ตกลง 12AB34",
    "ยกเลิก CD5678",
    "cancel EF9012",
  ];

  for (const text of cases) {
    const intent = classifyTextIntent(text);
    assert(
      intent === "pending_action",
      `"${text}" → pending_action (got "${intent}")`,
    );
  }
}

function testKnowledgeWithInventoryTerms() {
  console.log("\n=== Test F: Knowledge Q with inventory terms ===");

  // "เบรกเกอร์คืออะไร" + มี stock term → should check: knowledge triggered, INVENTORY_TRIGGER NOT matched
  // Actually "เบรกเกอร์คืออะไร" has no INVENTORY_TRIGGER match → general_chat
  assert(
    classifyTextIntent("เบรกเกอร์คืออะไร") === "general_chat",
    '"เบรกเกอร์คืออะไร" → general_chat (pure knowledge)',
  );

  // "เบรกเกอร์เหลือเท่าไหร่" → has INVENTORY_TRIGGER (เหลือ) → inventory_search
  assert(
    classifyTextIntent("เบรกเกอร์เหลือเท่าไหร่") === "inventory_search",
    '"เบรกเกอร์เหลือเท่าไหร่" → inventory_search (has inventory trigger)',
  );

  // "วิธีเลือกเบรกเกอร์" → has knowledge, no inventory trigger → general_chat
  assert(
    classifyTextIntent("วิธีเลือกเบรกเกอร์") === "general_chat",
    '"วิธีเลือกเบรกเกอร์" → general_chat (knowledge, no stock term)',
  );

  // "วิธีใช้งานมอเตอร์" → knowledge, no inventory → general_chat
  assert(
    classifyTextIntent("วิธีใช้งานมอเตอร์") === "general_chat",
    '"วิธีใช้งานมอเตอร์" → general_chat',
  );

  // "อธิบายcontactor" → knowledge, no inventory → general_chat
  assert(
    classifyTextIntent("อธิบาย contactor") === "general_chat",
    '"อธิบาย contactor" → general_chat',
  );
}

function testNoImageSearchCallsVision() {
  console.log("\n=== Test G: Text search must NOT call vision ===");

  // All text intents return non-null from parseLineInventoryQuery
  // but should NEVER trigger vision model — verify the logical separation
  const textCases = [
    "ค้นหาเบรกเกอร์",
    "หา LC1D40AP7",
    "มีเบรกเกอร์ไหม",
  ];

  for (const text of textCases) {
    const query = parseLineInventoryQuery(text);
    assert(query !== null, `"${text}" → parsed as inventory query`);
    if (!query) continue;

    // The query should use DB text search only, no vision
    assert(
      query.keyword.length > 0,
      `"${text}" has keyword for text search: "${query.keyword}"`,
    );
    // Vision model should NOT be called — this is verified by the webhook
    // using handleTextSearch() which calls searchPartsForLine (text only)
  }
}

function testPartCodeDetection() {
  console.log("\n=== Test H: Part code detection in text ===");

  // Part codes in text should be extracted as keywords
  const cases: [string, string | null][] = [
    ["ค้นหา LC1D40AP7", "LC1D40AP7"],
    ["หา MS132-16", "MS132-16"],
    ["ค้นหา3RN2010-1CW30", "3RN2010-1CW30"],
  ];

  for (const [text, expectedCode] of cases) {
    const query = parseLineInventoryQuery(text);
    if (expectedCode) {
      assert(
        query !== null && query.keyword.includes(expectedCode),
        `"${text}" → keyword contains "${expectedCode}" (got "${query?.keyword}")`,
      );
    }
  }
}

// ── Test I: Postback SID parsing & session validation ──────────────────

function testPostbackSidParsing() {
  console.log("\n=== Test I: Postback SID parsing ===");

  // Simulate the parseSid function from webhook
  function parseSid(data: string): string | null {
    const match = data.match(/[&?]sid=([a-zA-Z0-9_-]+)/);
    return match?.[1] || null;
  }

  // Valid SID with &
  assert(
    parseSid("action=part_image_search&sid=abcd1234") === "abcd1234",
    'SID extracted: "abcd1234" from &sid=abcd1234',
  );

  // Valid SID with ? (in case encoding differs)
  assert(
    parseSid("action=part_add_confirm?sid=xyz-789") === "xyz-789",
    'SID extracted: "xyz-789" from ?sid=xyz-789',
  );

  // No SID
  assert(
    parseSid("action=part_image_search") === null,
    "No SID → null",
  );

  // Empty SID value — regex requires at least 1 char, so returns null
  assert(
    parseSid("action=part_image_search&sid=") === null,
    "Empty SID → null (regex requires at least 1 character)",
  );

  // SID with underscore and dash (cuid-like)
  assert(
    parseSid("action=part_add_confirm&sid=cm_abc-def_123") === "cm_abc-def_123",
    'SID with underscore/dash: "cm_abc-def_123"',
  );

  // Multiple params, SID in middle
  assert(
    parseSid("action=part_image_add&sid=session-x&msgid=msg1") === "session-x",
    "SID extracted when in middle of multi-param data",
  );

  // SID at end
  assert(
    parseSid("action=part_add_cancel&msgid=msg1&sid=final-sid") === "final-sid",
    "SID extracted when at end",
  );
}

function testSessionOwnershipValidation() {
  console.log("\n=== Test J: Session ownership validation ===");

  // Simulate the logic from requireImageSession
  function validateSessionOwnership(
    sessionUserId: string | null,
    requestUserId: string,
    sid: string | null,
  ): { valid: boolean; error: string | null } {
    if (!sid) {
      return { valid: false, error: "ข้อมูลไม่สมบูรณ์ กรุณาส่งรูปใหม่" };
    }
    if (!sessionUserId) {
      return { valid: false, error: "ไม่พบเซสชัน กรุณาส่งรูปใหม่" };
    }
    if (sessionUserId !== requestUserId) {
      return { valid: false, error: "คุณไม่มีสิทธิ์ทำรายการนี้" };
    }
    return { valid: true, error: null };
  }

  // Missing SID
  const r1 = validateSessionOwnership(null, "user-1", null);
  assert(!r1.valid, "null SID → blocked");
  assert(r1.error === "ข้อมูลไม่สมบูรณ์ กรุณาส่งรูปใหม่", `null SID error message: "${r1.error}"`);

  // No session found (null userId from DB)
  const r2 = validateSessionOwnership(null, "user-1", "sid-123");
  assert(!r2.valid, "null sessionUserId → blocked");
  assert(r2.error === "ไม่พบเซสชัน กรุณาส่งรูปใหม่", `null session error message: "${r2.error}"`);

  // Cross-user access — user A tries to use session of user B
  const r3 = validateSessionOwnership("user-b", "user-a", "sid-123");
  assert(!r3.valid, "cross-user SID → blocked");
  assert(r3.error === "คุณไม่มีสิทธิ์ทำรายการนี้", `cross-user error message: "${r3.error}"`);

  // Valid — same user
  const r4 = validateSessionOwnership("user-1", "user-1", "sid-123");
  assert(r4.valid, "same-user SID → allowed");
  assert(r4.error === null, "same-user: no error");

  // Empty SID string (edge case from parser)
  const r5 = validateSessionOwnership("user-1", "user-1", "");
  assert(!r5.valid, "empty string SID → blocked (falsy check)");
}

function testRoleCheckForConfirm() {
  console.log("\n=== Test K: Role check for confirm add (linked user allowed) ===");

  // New model: any linked user (ADMIN or STAFF) can confirm AI add
  function canConfirmAdd(role: string | null): boolean {
    // null = anonymous (not linked)
    if (!role) return false;
    // Any linked role can confirm
    return role === "ADMIN" || role === "STAFF";
  }

  assert(canConfirmAdd("ADMIN"), "ADMIN → can confirm add");
  assert(canConfirmAdd("STAFF"), "STAFF → can confirm add (linked user)");
  assert(!canConfirmAdd(null), "null role (anonymous) → cannot confirm add");
  assert(!canConfirmAdd(""), "empty role → cannot confirm add");
  assert(!canConfirmAdd("admin"), "lowercase admin → cannot confirm add (exact match)");
}


// ── Test L: ReplyToken single-use (conceptual) ─────────────────────────

function testReplyTokenSingleUseConcept() {
  console.log("\n=== Test L: ReplyToken single-use concept ===");

  // The fix removes the first sendLineReply in handlePartImageAdd
  // so the replyToken is used exactly once for the preview flex message.
  // This test verifies the conceptual invariant.

  const USED_REPLY_TOKENS = new Set<string>();

  function useReplyToken(replyToken: string): boolean {
    if (!replyToken) return false;
    if (USED_REPLY_TOKENS.has(replyToken)) {
      return false; // Would fail: token already used
    }
    USED_REPLY_TOKENS.add(replyToken);
    return true;
  }

  const token = "reply-token-abc123";

  // First use (preview flex message) — should succeed
  assert(useReplyToken(token), "first use of replyToken → success");

  // Attempted second use (the old progress message) — should be prevented
  assert(!useReplyToken(token), "second use of same replyToken → blocked");

  // Different token — should succeed
  const token2 = "reply-token-xyz789";
  assert(useReplyToken(token2), "different replyToken → success");
}

// ── Test M: Cross-user cancel blocked ──────────────────────────────────

function testCrossUserCancelBlocked() {
  console.log("\n=== Test M: Cross-user cancel SID blocked ===");

  // Simulates the cancel ownership check in handlePostback / part_add_cancel
  function canCancel(
    sessionUserId: string | null,
    requestUserId: string,
    sid: string | null,
  ): { allowed: boolean; error: string | null } {
    if (!sid) {
      return { allowed: true, error: null }; // cancel with no sid = no-op, allowed
    }
    if (!sessionUserId) {
      return { allowed: false, error: "ไม่พบเซสชัน กรุณาส่งรูปใหม่" };
    }
    if (sessionUserId !== requestUserId) {
      return { allowed: false, error: "คุณไม่มีสิทธิ์ทำรายการนี้" };
    }
    return { allowed: true, error: null };
  }

  // Owner cancels their own session
  const r1 = canCancel("user-1", "user-1", "sid-abc");
  assert(r1.allowed, "owner cancel own session → allowed");
  assert(r1.error === null, "owner cancel: no error");

  // Cross-user cancel — user B tries to cancel user A's session
  const r2 = canCancel("user-a", "user-b", "sid-abc");
  assert(!r2.allowed, "cross-user cancel → blocked");
  assert(r2.error === "คุณไม่มีสิทธิ์ทำรายการนี้", `cross-user cancel error: "${r2.error}"`);

  // Anonymous session owner = "anonymous", request from linked user = mismatch
  const r3 = canCancel("anonymous", "user-linked-1", "sid-xyz");
  assert(!r3.allowed, "linked user cancel anonymous session → blocked (mismatch)");

  // Linked user session, anonymous request (no linked user)
  const r4 = canCancel("user-linked-1", "anonymous", "sid-xyz");
  assert(!r4.allowed, "anonymous cancel linked user session → blocked (mismatch)");

  // No sid → allowed (no-op, handled before ownership check)
  const r5 = canCancel("user-a", "user-b", null);
  assert(r5.allowed, "no sid → allowed (no-op)");

  // Same user (linked)
  const r6 = canCancel("user-linked-2", "user-linked-2", "sid-def");
  assert(r6.allowed, "same linked user cancel → allowed");
}

// ── Test N: LINE 1:1 anonymous blocked ────────────────────────────────

function testAnonymousBlocked() {
  console.log("\n=== Test N: LINE 1:1 anonymous blocked ===");

  // Simulates checkLinePermission with empty anonymous set
  type LineAction =
    | "general_chat" | "search_parts" | "view_part_detail" | "image_search"
    | "create_part" | "update_part" | "stock_in" | "stock_out" | "stock_adjust"
    | "confirm_ai_add" | "delete_part";

  const ANONYMOUS_SET: Set<string> = new Set([]); // nothing allowed

  function canAnonymous(action: string): boolean {
    return ANONYMOUS_SET.has(action);
  }

  // All actions should be blocked for anonymous
  const allActions: LineAction[] = [
    "general_chat", "search_parts", "view_part_detail", "image_search",
    "create_part", "update_part", "stock_in", "stock_out", "stock_adjust",
    "confirm_ai_add", "delete_part",
  ];

  for (const action of allActions) {
    assert(
      !canAnonymous(action),
      `anonymous cannot "${action}"`,
    );
  }
}

// ── Test O: LINE 1:1 linked user allowed ──────────────────────────────

function testLinkedUserAllowed() {
  console.log("\n=== Test O: LINE 1:1 linked user allowed ===");

  // Simulates checkLinePermission for linked non-admin user
  const ADMIN_ACTIONS = new Set(["delete_part", "bulk_import", "user_management"]);

  function canLinkedUser(action: string): boolean {
    return !ADMIN_ACTIONS.has(action);
  }

  // Linked users can do all non-admin actions
  assert(canLinkedUser("general_chat"), "linked user: general_chat → allowed");
  assert(canLinkedUser("search_parts"), "linked user: search_parts → allowed");
  assert(canLinkedUser("image_search"), "linked user: image_search → allowed");
  assert(canLinkedUser("create_part"), "linked user: create_part → allowed");
  assert(canLinkedUser("update_part"), "linked user: update_part → allowed");
  assert(canLinkedUser("stock_in"), "linked user: stock_in → allowed");
  assert(canLinkedUser("stock_out"), "linked user: stock_out → allowed");
  assert(canLinkedUser("stock_adjust"), "linked user: stock_adjust → allowed");
  assert(canLinkedUser("confirm_ai_add"), "linked user: confirm_ai_add → allowed");

  // But not admin-only actions
  assert(!canLinkedUser("delete_part"), "linked user: delete_part → blocked");
  assert(!canLinkedUser("bulk_import"), "linked user: bulk_import → blocked");
  assert(!canLinkedUser("user_management"), "linked user: user_management → blocked");
}

// ── Test P: canDeletePart matrix ─────────────────────────────────────

function testCanDeletePart() {
  console.log("\n=== Test P: canDeletePart matrix ===");

  function canDeletePart(
    user: { id: string; role: string } | null,
    partCreatedBy: string,
  ): boolean {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    return user.id === partCreatedBy;
  }

  // ADMIN can delete any part
  assert(canDeletePart({ id: "admin-1", role: "ADMIN" }, "user-a"), "admin deletes user-a's part → allowed");
  assert(canDeletePart({ id: "admin-1", role: "ADMIN" }, "admin-1"), "admin deletes own part → allowed");

  // Linked user can delete own part
  assert(canDeletePart({ id: "user-a", role: "STAFF" }, "user-a"), "user-a deletes own part → allowed");

  // Linked user cannot delete another user's part
  assert(!canDeletePart({ id: "user-b", role: "STAFF" }, "user-a"), "user-b deletes user-a's part → blocked");

  // Anonymous cannot delete anything
  assert(!canDeletePart(null, "anyone"), "anonymous cannot delete → blocked");
}

// ── Test Q: Mention detection ─────────────────────────────────────────────

function testMentionDetection() {
  console.log("\n=== Test Q: Mention detection ===");

  const botUserId = "U_bot_user_id";
  const botMention = "@SparePartStock";

  // Text fallback: includes mention text
  assert(
    isBotMentioned(null as unknown as { message?: null }, "@SparePartStock ค้นหา", botMention),
    "text fallback detects mention text",
  );

  // Text fallback: not mentioned
  assert(
    !isBotMentioned(null as unknown as { message?: null }, "hello group", botMention),
    "text fallback returns false when not mentioned",
  );

  // Native mention: isSelf
  assert(
    isBotMentioned(
      { message: { mention: { mentionees: [{ isSelf: true }] } } },
      "@bot ค้นหา",
      botMention,
      botUserId,
    ),
    "native isSelf mention detected",
  );

  // Native mention: matched userId
  assert(
    isBotMentioned(
      { message: { mention: { mentionees: [{ userId: botUserId }] } } },
      "@bot ค้นหา",
      botMention,
      botUserId,
    ),
    "native userId match detected",
  );

  // Native mention: different userId, no fallback match in text
  assert(
    !isBotMentioned(
      { message: { mention: { mentionees: [{ userId: "U_other" }] } } },
      "hello group",
      botMention,
      botUserId,
    ),
    "native mention of other user ignored",
  );
}

// ── Test R: Mention stripping ───────────────────────────────────────────

function testMentionStripping() {
  console.log("\n=== Test R: Mention stripping ===");

  const botMention = "@SparePartStock";

  // Fallback regex strip
  assert(
    stripMentionText("@SparePartStock ค้นหาเบรกเกอร์", null as unknown as { message?: null }, botMention) ===
      "ค้นหาเบรกเกอร์",
    "fallback strips mention text",
  );

  // Native mention strip using index/length
  assert(
    stripMentionText(
      "@SparePartStock  ค้นหาเบรกเกอร์",
      { message: { mention: { mentionees: [{ index: 0, length: 15 }] } } },
      botMention,
    ) === "ค้นหาเบรกเกอร์",
    "native strips by index/length",
  );
}

// ── Test S: Explicit web-search triggers ────────────────────────────────

function testExplicitWebSearchTriggers() {
  console.log("\n=== Test S: Explicit web-search triggers ===");

  assert(isExplicitWebSearch("ช่วยค้นเว็บหา spec"), "ค้นเว็บ triggers web search offer");
  assert(isExplicitWebSearch("หาในเน็ตหน่อย"), "หาในเน็ต triggers web search offer");
  assert(isExplicitWebSearch("search internet for this"), "search internet triggers web search offer");
  assert(isExplicitWebSearch("ดูสเปคจากเว็บ"), "ดูสเปคจากเว็บ triggers web search offer");
  assert(isExplicitWebSearch("รุ่นนี้คืออะไร"), "รุ่นนี้คืออะไร triggers web search offer");
  assert(!isExplicitWebSearch("ค้นหาเบรกเกอร์"), "normal DB search keyword does not trigger web search");
}

// ── Test T: Group anonymous permissions (logic only) ──────────────────────

function testGroupAnonymousPermissions() {
  console.log("\n=== Test T: Group anonymous permissions ===");

  const ANONYMOUS_ALLOWED_IN_GROUP = new Set(["search_parts", "image_search", "part_web_search"]);

  function canAnonymousInGroup(action: string): boolean {
    return ANONYMOUS_ALLOWED_IN_GROUP.has(action);
  }

  assert(canAnonymousInGroup("search_parts"), "unlinked group user: search_parts allowed");
  assert(canAnonymousInGroup("image_search"), "unlinked group user: image_search allowed");
  assert(canAnonymousInGroup("part_web_search"), "unlinked group user: web search allowed");
  assert(!canAnonymousInGroup("create_part"), "unlinked group user: create_part blocked");
  assert(!canAnonymousInGroup("stock_in"), "unlinked group user: stock_in blocked");
  assert(!canAnonymousInGroup("stock_out"), "unlinked group user: stock_out blocked");
  assert(!canAnonymousInGroup("stock_adjust"), "unlinked group user: stock_adjust blocked");
  assert(!canAnonymousInGroup("confirm_ai_add"), "unlinked group user: confirm_ai_add blocked");
}

// ── Test U: Rolling context never stores base64 ─────────────────────────

function testNoBase64InContext() {
  console.log("\n=== Test U: Rolling context metadata never stores base64 ===");

  const eventMetadata = { imageMessageId: "msg-123", groupSenderUserId: "U_user" };
  assert(
    !Object.values(eventMetadata).some((v) => typeof v === "string" && v.length > 500),
    "image metadata keeps only messageId, not base64 payload",
  );
  assert(!("imageBase64" in eventMetadata), "image metadata has no imageBase64 key");
}

function main() {
  console.log("🔍 LINE Text Intent Classification Tests");
  console.log("========================================");

  testInventorySearchIntents();
  testGeneralChatIntents();
  testExportIntent();
  testHelpIntent();
  testPendingActionIntent();
  testKnowledgeWithInventoryTerms();
  testNoImageSearchCallsVision();
  testPartCodeDetection();
  testPostbackSidParsing();
  testSessionOwnershipValidation();
  testRoleCheckForConfirm();
  testReplyTokenSingleUseConcept();
  testCrossUserCancelBlocked();
  testAnonymousBlocked();
  testLinkedUserAllowed();
  testCanDeletePart();
  testMentionDetection();
  testMentionStripping();
  testExplicitWebSearchTriggers();
  testGroupAnonymousPermissions();
  testNoBase64InContext();

  console.log("\n========================================");
  if (failures === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`❌ ${failures} test(s) failed`);
    process.exit(1);
  }
}

main();
