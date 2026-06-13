// Flex Message templates for LINE Chat
// สร้าง Flex Messages ที่สวยงามสำหรับแสดงผลข้อมูลอะไหล่

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://spare.birdsphichitchai.dev";
const LIFF_ID =
  process.env.NEXT_PUBLIC_LIFF_ID ||
  process.env.NEXT_PUBLIC_LINE_LIFF_ID ||
  "2010187689-ZCU84P4L";
const LIFF_BASE_URL = LIFF_ID
  ? `https://liff.line.me/${LIFF_ID}`
  : `${APP_URL}/liff`;
const LIFF_LINK_URL = LIFF_BASE_URL;

function liffPath(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return LIFF_ID
    ? `https://liff.line.me/${LIFF_ID}/${normalizedPath}`
    : `${APP_URL}/liff/${normalizedPath}`;
}

type FlexPart = {
  id?: string;
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit?: string | null;
  location?: string | null;
  plant?: string | null;
  imageUrl?: string | null;
  category?: { name: string } | null;
  building?: { name: string } | null;
};

type StorageStats = {
  totals: {
    totalParts: number;
    totalQuantity: number;
    lowStockCount: number;
  };
  buildings: Array<{
    name: string;
    partCount: number;
  }>;
};

type BuildingFlexItem = {
  name: string;
  partCount: number;
};

function absoluteImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `${APP_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function stockStatus(part: FlexPart): { text: string; color: string } {
  if (part.quantity <= 0) return { text: "หมด", color: "#D32F2F" };
  if (part.quantity <= part.minimumQuantity) return { text: "ต่ำกว่าขั้นต่ำ", color: "#F57C00" };
  return { text: "คงเหลือ", color: "#1DB446" };
}

function createInfoRow(label: string, value?: string | number | null, color = "#111111"): unknown | null {
  if (value === undefined || value === null || value === "") return null;
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: label, size: "xs", color: "#6B7280", flex: 2 },
      { type: "text", text: String(value), size: "xs", color, weight: "bold", align: "end", flex: 4, wrap: true },
    ],
  };
}

// สร้าง Flex Message สำหรับ help
export function createHelpFlex(): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "เมนู Spare Part Stock", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: "เลือกงานที่ต้องการ หรือพิมพ์ชื่ออะไหล่เพื่อค้นหาในแชทได้เลย", size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: "ตัวอย่างค้นหา: contactor เหลือเท่าไหร่", size: "xs", color: "#6B7280", wrap: true },
            { type: "text", text: "ระบุเพิ่มได้ เช่น BLOCK 1 อาคาร ท.003", size: "xs", color: "#6B7280", wrap: true },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "message", label: "ค้นหาอะไหล่ตัวอย่าง", text: "contactor เหลือเท่าไหร่" },
          style: "primary",
          color: "#2563EB",
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              action: { type: "uri", label: "สแกน QR", uri: liffPath("scan") },
              style: "secondary",
              flex: 1,
            },
            {
              type: "button",
              action: { type: "uri", label: "เพิ่มอะไหล่", uri: liffPath("add-part") },
              style: "secondary",
              flex: 1,
            },
          ],
        },
        {
          type: "button",
          action: { type: "uri", label: "เพิ่ม / ลด / เบิกสต็อก", uri: liffPath("stock-move") },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };
}

export function createLoginRequiredFlex(): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "เข้าสู่ระบบก่อนใช้งาน", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: "เพื่อป้องกันข้อมูลสต็อก บอทจะตอบคำถามหลังจากผูกบัญชี LINE กับผู้ใช้ในระบบแล้วเท่านั้น", size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        { type: "text", text: "กดปุ่มด้านล่างเพื่อเปิดหน้า Login/Link Account ใน LINE", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "Login / Link Account",
            uri: LIFF_LINK_URL,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };
}

export function createLoginSuccessFlex(userName?: string): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "ล็อกอินสำเร็จ", weight: "bold", size: "lg", color: "#1DB446", wrap: true },
        {
          type: "text",
          text: userName ? `เชื่อมต่อบัญชี ${userName} กับ LINE เรียบร้อยแล้ว` : "เชื่อมต่อบัญชีกับ LINE เรียบร้อยแล้ว",
          size: "sm",
          color: "#4B5563",
          wrap: true,
        },
        { type: "separator" },
        { type: "text", text: "เลือกเมนูด้านล่าง หรือพิมพ์ชื่ออะไหล่เพื่อค้นหาได้เลย", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
  };
}

// สร้าง Flex Message สำหรับผลการค้นหา
export function createSearchResultsFlex(keyword: string, parts: FlexPart[]): unknown {
  if (parts.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: `ค้นหา "${keyword}"`, weight: "bold", size: "lg", wrap: true },
          { type: "text", text: "ไม่พบอะไหล่ที่ตรงกับคำค้น", size: "sm", color: "#6B7280", wrap: true },
          { type: "text", text: "ลองระบุชื่ออะไหล่ รหัส Block หรืออาคารให้ชัดขึ้น", size: "xs", color: "#9CA3AF", wrap: true },
        ],
      },
    };
  }

  const bubbles = parts.slice(0, 10).map((p) => {
    const status = stockStatus(p);
    const imageUrl = absoluteImageUrl(p.imageUrl);
    const detailUri = `${APP_URL}/parts/${p.id ?? ""}`;

    return {
      type: "bubble",
      size: "mega",
      hero: imageUrl
        ? {
            type: "image",
            url: imageUrl,
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover",
          }
        : undefined,
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "text", text: p.partNumber, weight: "bold", size: "md", color: "#111111", flex: 4, wrap: true },
              { type: "text", text: status.text, size: "xs", color: status.color, weight: "bold", align: "end", flex: 2, wrap: true },
            ],
          },
          { type: "text", text: p.partName, size: "sm", color: "#374151", wrap: true },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              createInfoRow("จำนวน", `${p.quantity} ${p.unit || "pcs"}`, status.color),
              createInfoRow("ขั้นต่ำ", p.minimumQuantity),
              createInfoRow("ที่เก็บ", p.location),
              createInfoRow("อาคาร", p.building?.name),
              createInfoRow("Block", p.plant),
              createInfoRow("หมวด", p.category?.name),
            ].filter(Boolean),
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: { type: "uri", label: "ดูรายละเอียด", uri: detailUri },
            style: "primary",
            color: "#1DB446",
          },
        ],
      },
    };
  });

  return {
    type: "carousel",
    contents: bubbles,
  };
}

// สร้าง Flex Message สำหรับข้อมูลสต็อก
export function createStockInfoFlex(part: FlexPart): unknown {
  const status = stockStatus(part);
  const imageUrl = absoluteImageUrl(part.imageUrl);

  return {
    type: "bubble",
    size: "mega",
    hero: imageUrl
      ? {
          type: "image",
          url: imageUrl,
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
        }
      : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            { type: "text", text: part.partNumber, weight: "bold", size: "lg", color: "#111111", flex: 4, wrap: true },
            { type: "text", text: status.text, size: "sm", weight: "bold", color: status.color, align: "end", flex: 2, wrap: true },
          ],
        },
        { type: "text", text: part.partName, size: "md", color: "#374151", wrap: true },
        { type: "separator" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            createInfoRow("จำนวน", `${part.quantity} ${part.unit || "pcs"}`, status.color),
            createInfoRow("ขั้นต่ำ", part.minimumQuantity),
            createInfoRow("ที่เก็บ", part.location),
            createInfoRow("อาคาร", part.building?.name),
            createInfoRow("Block", part.plant),
            createInfoRow("หมวด", part.category?.name),
          ].filter(Boolean),
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "ดูรายละเอียด",
            uri: `${APP_URL}/parts/${part.id}`,
          },
          style: "primary",
          color: "#1DB446",
          flex: 2,
        },
        {
          type: "button",
          action: {
            type: "uri",
            label: "สแกน QR",
            uri: `${APP_URL}/liff/scan`,
          },
          style: "secondary",
          flex: 1,
        },
      ],
    },
  };
}

// สร้าง Flex Message สำหรับสถิติ
export function createStatsFlex(stats: StorageStats): unknown {
  const buildingLines = stats.buildings.map(
    (b) => ({
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: `🏢 ${b.name}`, size: "sm", color: "#333333", flex: 3 },
        { type: "text", text: `${b.partCount} รายการ`, size: "sm", color: "#666666", align: "end", flex: 2 },
      ],
      margin: "sm",
    })
  );

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "📊 สรุปสต็อก", weight: "bold", size: "xl", color: "#1DB446" },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📦 อะไหล่ทั้งหมด", size: "md" },
                { type: "text", text: `${stats.totals.totalParts}`, size: "md", weight: "bold", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📊 จำนวนรวม", size: "md" },
                { type: "text", text: `${stats.totals.totalQuantity} ชิ้น`, size: "md", weight: "bold", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "⚠️ ต่ำกว่าขั้นต่ำ", size: "md" },
                { type: "text", text: `${stats.totals.lowStockCount}`, size: "md", weight: "bold", color: "#FF9900", align: "end" },
              ],
            },
          ],
        },
        { type: "separator", margin: "lg" },
        { type: "text", text: "🏢 แยกตามอาคาร", size: "md", weight: "bold", margin: "lg" },
        ...buildingLines,
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "เปิด Dashboard",
            uri: `${APP_URL}/dashboard`,
          },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };
}

export function createExportFlex(exportUri = `${APP_URL}/api/export`): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "ส่งออก Excel", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: "ดาวน์โหลดรายการอะไหล่ทั้งหมดเป็นไฟล์ Excel ผ่านระบบ Spare Part Stock", size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        { type: "text", text: "ถ้ายังไม่ได้เข้าสู่ระบบ หน้าเว็บจะให้ล็อกอินก่อนดาวน์โหลด", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "ดาวน์โหลด Excel", uri: exportUri },
          style: "primary",
          color: "#1DB446",
        },
        {
          type: "button",
          action: { type: "uri", label: "เปิด Dashboard", uri: `${APP_URL}/dashboard` },
          style: "secondary",
        },
      ],
    },
  };
}

// ── Image intent card ──────────────────────────────────────────────

export function createImageIntentFlex(sessionId: string): unknown {
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "📸", size: "xl", align: "center" },
        { type: "text", text: "คุณต้องการทำอะไรกับรูปนี้?", weight: "bold", size: "lg", align: "center", wrap: true },
        { type: "text", text: "ค้นหาอะไหล่ที่คล้ายจาก DB หรือเพิ่มเป็นอะไหล่ใหม่", size: "sm", color: "#6B7280", align: "center", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "postback", label: "🔍 ค้นหาอะไหล่จากรูป", data: `action=part_image_search&sid=${sessionId}` },
          style: "primary",
          color: "#2563EB",
        },
        {
          type: "button",
          action: { type: "postback", label: "➕ เพิ่มอะไหล่ใหม่", data: `action=part_image_add&sid=${sessionId}` },
          style: "secondary",
        },
      ],
    },
  };
}

// ── Add preview card ───────────────────────────────────────────────

export type AddPreviewSuggestion = {
  partNumber: string;
  partName: string;
  categoryName: string;
  subcategory: string;
  confidence: number;
  description: string;
  notes: string;
  unit: string;
  plant?: string;
  buildingId?: string;
  buildingName?: string;
  status?: string;
  createdPartId?: string;
  categoryId?: string | null;
  matchedCategoryName?: string | null;
  barcodeValue?: string | null;
  quantity?: number;
  minimumQuantity?: number;
  location?: string;
};

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function createAddPreviewFlex(
  suggestion: AddPreviewSuggestion,
  sessionId: string,
  buildings: Array<{ id: string; name: string }>,
): unknown {
  const isProvisional = suggestion.partNumber.startsWith("TMP-");
  const pnLabel = isProvisional ? "รหัสชั่วคราว (ยังไม่มีรหัสจริง)" : suggestion.partNumber;
  const confPct = Math.round(suggestion.confidence * 100);
  const confColor = confPct >= 85 ? "#1DB446" : confPct >= 60 ? "#F57C00" : "#D32F2F";
  const needsLocation = !suggestion.plant || !suggestion.buildingId;

  // ── Bubble 1: Preview + action buttons ──
  const previewBubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            { type: "text", text: "พรีวิวการเพิ่มอะไหล่", weight: "bold", size: "lg", color: "#111111", flex: 4, wrap: true },
            { type: "text", text: `${confPct}%`, size: "sm", weight: "bold", color: confColor, align: "end", flex: 1 },
          ],
        },
        { type: "separator" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: `รหัส: ${pnLabel}`, size: "sm", color: isProvisional ? "#F57C00" : "#111111", weight: isProvisional ? "bold" : "regular", wrap: true },
            { type: "text", text: `ชื่อ: ${suggestion.partName}`, size: "sm", color: "#111111", wrap: true },
            { type: "text", text: `หมวด: ${suggestion.categoryName} | ${suggestion.subcategory}`, size: "xs", color: "#6B7280", wrap: true },
            { type: "text", text: `ที่เก็บ: ${suggestion.plant || "ยังไม่เลือก Block"} / ${suggestion.buildingName || "ยังไม่เลือกอาคาร"}`, size: "xs", color: suggestion.plant && suggestion.buildingId ? "#6B7280" : "#F57C00", wrap: true },
            { type: "text", text: `หน่วย: ${suggestion.unit}`, size: "xs", color: "#6B7280" },
            suggestion.description
              ? { type: "text", text: truncateText(suggestion.description, 120), size: "xs", color: "#9CA3AF", wrap: true }
              : null,
            suggestion.notes && !isProvisional
              ? { type: "text", text: `ℹ️ ${truncateText(suggestion.notes, 100)}`, size: "xs", color: "#9CA3AF", wrap: true }
              : null,
            needsLocation
              ? { type: "text", text: "⚠️ กรุณาเลือก Block และอาคารก่อนยืนยัน", size: "xs", color: "#D32F2F", wrap: true }
              : null,
          ].filter(Boolean),
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "postback", label: needsLocation ? "ยืนยัน (ยังไม่ครบ)" : "✅ ยืนยันบันทึก", data: `action=part_add_confirm&sid=${sessionId}` },
          style: "primary",
          color: needsLocation ? "#F57C00" : "#1DB446",
        },
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              action: { type: "uri", label: "✏️ แก้ไข", uri: liffPath(`add-part?lineSid=${encodeURIComponent(sessionId)}`) },
              style: "secondary",
              flex: 1,
            },
            {
              type: "button",
              action: { type: "postback", label: "🔄 ใหม่", data: `action=part_add_retry&sid=${sessionId}` },
              style: "secondary",
              flex: 1,
            },
          ],
        },
        {
          type: "button",
          action: { type: "postback", label: "❌ ยกเลิก", data: `action=part_add_cancel&sid=${sessionId}` },
          style: "link",
        },
      ],
    },
  };

  // ── Bubble 2: Block/Building selectors ──
  const blockOptions = [
    { label: "Block 1", value: "BLOCK 1" },
    { label: "Block 2", value: "BLOCK 2" },
    { label: "Special Part", value: "SPECIAL PART" },
  ];

  const currentPlant = suggestion.plant || "";
  const currentBuildingName = suggestion.buildingName || "";
  const locationSummary = currentPlant || currentBuildingName
    ? `ปัจจุบัน: ${currentPlant || "-"} / ${currentBuildingName || "-"}`
    : "ยังไม่ได้เลือก";

  const selectorBubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "เลือกที่เก็บ", weight: "bold", size: "lg", color: "#111111" },
        { type: "text", text: locationSummary, size: "xs", color: needsLocation ? "#F57C00" : "#1DB446", wrap: true },
        { type: "separator" },
        // Block section
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: "🏷️ เลือก Block", size: "sm", weight: "bold", color: "#374151" },
            ...blockOptions.map((b) => ({
              type: "button",
              action: {
                type: "postback",
                label: currentPlant === b.value ? `✅ ${b.label}` : b.label,
                data: `action=part_add_set_plant&sid=${sessionId}&plant=${encodeURIComponent(b.value)}`,
              },
              style: currentPlant === b.value ? "primary" : "secondary",
              color: currentPlant === b.value ? "#1DB446" : undefined,
              margin: "sm",
            })),
          ],
        },
        { type: "separator" },
        // Building section
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: "🏢 เลือกอาคาร", size: "sm", weight: "bold", color: "#374151" },
            ...buildings.map((bld) => ({
              type: "button",
              action: {
                type: "postback",
                label: currentBuildingName === bld.name ? `✅ ${bld.name}` : bld.name,
                data: `action=part_add_set_building&sid=${sessionId}&building=${encodeURIComponent(bld.name)}`,
              },
              style: currentBuildingName === bld.name ? "primary" : "secondary",
              color: currentBuildingName === bld.name ? "#1DB446" : undefined,
              margin: "sm",
            })),
          ],
        },
      ],
    },
  };

  return {
    type: "carousel",
    contents: [previewBubble, selectorBubble],
  };
}

// ── Add success card ────────────────────────────────────────────────

export function createAddSuccessFlex(partNumber: string, partName: string): unknown {
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "✅", size: "xl", align: "center" },
        { type: "text", text: "เพิ่มอะไหล่สำเร็จ", weight: "bold", size: "lg", align: "center", color: "#1DB446" },
        { type: "separator" },
        { type: "text", text: `รหัส: ${partNumber}`, size: "md", color: "#111111", wrap: true },
        { type: "text", text: partName, size: "sm", color: "#4B5563", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "ดูรายละเอียด", uri: `${APP_URL}/parts/new` },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };
}

// ── Login required for specific action ──────────────────────────────

export function createLoginRequiredForActionFlex(actionLabel: string): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "🔒 ต้องล็อกอินก่อน", weight: "bold", size: "lg", color: "#D32F2F", wrap: true },
        { type: "text", text: `"${actionLabel}" ต้องใช้บัญชีที่ผูกกับระบบ`, size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        { type: "text", text: "กดปุ่มด้านล่างเพื่อล็อกอินหรือผูกบัญชี LINE กับผู้ใช้ในระบบ", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "🔑 ล็อกอิน / ผูกบัญชี LINE", uri: LIFF_LINK_URL },
          style: "primary",
          color: "#1DB446",
        },
        {
          type: "button",
          action: { type: "postback", label: "ยกเลิก", data: "action=part_add_cancel" },
          style: "link",
        },
      ],
    },
  };
}

// ── Web search offer card (DB miss) ─────────────────────────────────

export function createWebSearchOfferFlex(keyword: string): unknown {
  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "🔍 ไม่พบในฐานข้อมูล", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: `ไม่พบ "${keyword}" ในคลังอะไหล่`, size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        { type: "text", text: "ลองค้นหาจากแหล่งข้อมูลภายนอก หรือเพิ่มเป็นอะไหล่ใหม่ในระบบ", size: "xs", color: "#6B7280", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "postback", label: "🔍 ค้นเว็บ", data: `action=part_web_search&q=${encodeURIComponent(keyword.slice(0, 80))}` },
          style: "primary",
          color: "#2563EB",
        },
        {
          type: "button",
          action: { type: "uri", label: "➕ เพิ่มเป็นอะไหล่ใหม่", uri: liffPath("add-part") },
          style: "secondary",
        },
        {
          type: "button",
          action: { type: "postback", label: "ยกเลิก", data: "action=search_cancel" },
          style: "link",
        },
      ],
    },
  };
}

// ── Web search results carousel ──────────────────────────────────────

type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  sourceDomain: string;
  score: number;
};

export function createWebSearchResultsFlex(
  query: string,
  results: WebSearchResultItem[],
): unknown {
  if (results.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "🔍 ค้นเว็บ", weight: "bold", size: "lg", wrap: true },
          { type: "text", text: `ไม่พบข้อมูล "${query}" จากแหล่งภายนอก`, size: "sm", color: "#6B7280", wrap: true },
          { type: "text", text: "ลองใช้คำค้นอื่น หรือเพิ่มเป็นอะไหล่ใหม่ในระบบ", size: "xs", color: "#9CA3AF", wrap: true },
        ],
      },
    };
  }

  const bubbles = results.slice(0, 5).map((r) => {
    const scoreColor = r.score >= 0.8 ? "#1DB446" : r.score >= 0.5 ? "#F57C00" : "#9CA3AF";
    const snippet = r.snippet.length > 160 ? r.snippet.slice(0, 157) + "..." : r.snippet;

    return {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "text", text: r.title.slice(0, 60), weight: "bold", size: "sm", color: "#111111", flex: 4, wrap: true },
              { type: "text", text: `${Math.round(r.score * 100)}%`, size: "xs", color: scoreColor, weight: "bold", align: "end", flex: 1 },
            ],
          },
          { type: "text", text: snippet, size: "xs", color: "#4B5563", wrap: true },
          { type: "separator" },
          { type: "text", text: `📎 ${r.sourceDomain}`, size: "xs", color: "#6B7280", wrap: true },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: { type: "uri", label: "เปิดแหล่งข้อมูล", uri: r.url },
            style: "primary",
            color: "#2563EB",
          },
        ],
      },
    };
  });

  return {
    type: "carousel",
    contents: bubbles,
  };
}

// ── Image selection card (multiple recent images) ────────────────────

export type SelectableImage = {
  messageId: string;
  senderName: string;
  timestamp: string;
};

export function createImageSelectionFlex(images: SelectableImage[]): unknown {
  const MAX_DISPLAY = 4;
  const displayImages = images.slice(0, MAX_DISPLAY);

  const buttons = displayImages.map((img, i) => ({
    type: "button",
    action: {
      type: "postback",
      label: `รูป${i + 1}: ${img.senderName} (${img.timestamp})`,
      data: `action=select_image&msgid=${img.messageId}`,
    },
    style: "secondary",
    margin: "sm",
  }));

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "📸 เลือกรูปที่ต้องการ", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: `มี ${images.length} รูปล่าสุดในกลุ่ม เลือกรูปที่ต้องการใช้`, size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        ...buttons,
        {
          type: "button",
          action: { type: "postback", label: "❌ ยกเลิก", data: "action=image_select_cancel" },
          style: "link",
        },
      ],
    },
  };
}

// ── Stock summary flex ──────────────────────────────────────────────

type StockSummaryForFlex = {
  totalParts: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  examples: FlexPart[];
};

export function createStockSummaryFlex(
  result: StockSummaryForFlex,
  filterText: string,
): unknown {
  const exampleRows = result.examples.slice(0, 5).map((p) => {
    const status = stockStatus(p);
    return {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      margin: "sm",
      contents: [
        { type: "text", text: status.text, size: "xs", color: status.color, flex: 1 },
        { type: "text", text: p.partNumber, size: "xs", color: "#111111", weight: "bold", flex: 3, wrap: true },
        { type: "text", text: `${p.quantity} ${p.unit || "pcs"}`, size: "xs", color: "#6B7280", align: "end", flex: 2 },
      ],
    };
  });

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "📊 สรุปสถานะสต็อก", weight: "bold", size: "lg", color: "#1DB446", wrap: true },
        filterText ? { type: "text", text: filterText, size: "xs", color: "#6B7280", wrap: true } : null,
        { type: "separator" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📦 รายการทั้งหมด", size: "sm", flex: 3 },
                { type: "text", text: String(result.totalParts), size: "sm", weight: "bold", align: "end", flex: 1 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "📊 จำนวนรวม", size: "sm", flex: 3 },
                { type: "text", text: `${result.totalQuantity} ชิ้น`, size: "sm", weight: "bold", align: "end", flex: 1 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "✅ คงเหลือปกติ", size: "sm", flex: 3 },
                { type: "text", text: String(result.inStockCount), size: "sm", weight: "bold", color: "#1DB446", align: "end", flex: 1 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "⚠️ ต่ำกว่าขั้นต่ำ", size: "sm", flex: 3 },
                { type: "text", text: String(result.lowStockCount), size: "sm", weight: "bold", color: "#F57C00", align: "end", flex: 1 },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "❌ หมด", size: "sm", flex: 3 },
                { type: "text", text: String(result.outOfStockCount), size: "sm", weight: "bold", color: "#D32F2F", align: "end", flex: 1 },
              ],
            },
          ],
        },
        result.examples.length > 0 ? { type: "separator" } : null,
        result.examples.length > 0
          ? { type: "text", text: "ตัวอย่างอะไหล่", size: "sm", weight: "bold", color: "#4B5563" }
          : null,
        ...exampleRows,
      ].filter(Boolean),
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "ดู Dashboard", uri: `${APP_URL}/dashboard` },
          style: "primary",
          color: "#1DB446",
          flex: 1,
        },
      ],
    },
  };
}

// ── Low stock flex ──────────────────────────────────────────────────

export function createLowStockFlex(parts: FlexPart[], totalCount: number): unknown {
  if (parts.length === 0) {
    return {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "✅ ไม่มีอะไหล่ต่ำกว่าขั้นต่ำ", weight: "bold", size: "lg", color: "#1DB446", wrap: true },
        ],
      },
    };
  }

  const bubbles = parts.slice(0, 5).map((p) => {
    const status = stockStatus(p);
    const pct = p.minimumQuantity > 0
      ? Math.round((p.quantity / p.minimumQuantity) * 100)
      : 0;

    return {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              { type: "text", text: p.partNumber, weight: "bold", size: "md", color: "#111111", flex: 4, wrap: true },
              { type: "text", text: status.text, size: "xs", color: status.color, weight: "bold", align: "end", flex: 2, wrap: true },
            ],
          },
          { type: "text", text: p.partName, size: "sm", color: "#374151", wrap: true },
          { type: "separator" },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              createInfoRow("คงเหลือ", `${p.quantity} ${p.unit || "pcs"}`, status.color),
              createInfoRow("ขั้นต่ำ", `${p.minimumQuantity} ${p.unit || "pcs"}`),
              createInfoRow("ระดับ", `${pct}%`),
              createInfoRow("ที่เก็บ", p.location),
              createInfoRow("อาคาร", p.building?.name),
              createInfoRow("Block", p.plant),
            ].filter(Boolean),
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: { type: "uri", label: "ดูรายละเอียด", uri: `${APP_URL}/parts/${p.id ?? ""}` },
            style: "primary",
            color: "#F57C00",
          },
        ],
      },
    };
  });

  const totalBubble = {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "⚠️", size: "xl", align: "center" },
        { type: "text", text: `มี ${totalCount} รายการที่ต่ำกว่าขั้นต่ำ`, weight: "bold", size: "md", color: "#F57C00", align: "center", wrap: true },
        { type: "text", text: `แสดง ${Math.min(parts.length, 5)} รายการ`, size: "xs", color: "#6B7280", align: "center" },
      ],
    },
  };

  return {
    type: "carousel",
    contents: [totalBubble, ...bubbles],
  };
}

// ── Existing flex builders ──────────────────────────────────────────

export function createBuildingListFlex(buildings: BuildingFlexItem[]): unknown {
  const rows = buildings.slice(0, 12).map((building) => ({
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      { type: "text", text: building.name, size: "sm", color: "#111111", flex: 3, wrap: true },
      {
        type: "text",
        text: `${building.partCount} รายการ`,
        size: "sm",
        color: "#1DB446",
        weight: "bold",
        align: "end",
        flex: 2,
        wrap: true,
      },
    ],
  }));

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "อาคารที่มีในระบบ", weight: "bold", size: "lg", color: "#111111", wrap: true },
        { type: "text", text: `ทั้งหมด ${buildings.length} อาคาร`, size: "sm", color: "#4B5563", wrap: true },
        { type: "separator" },
        ...rows,
        buildings.length > rows.length
          ? { type: "text", text: `และอีก ${buildings.length - rows.length} อาคาร`, size: "xs", color: "#6B7280", wrap: true }
          : null,
      ].filter(Boolean),
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: { type: "uri", label: "เปิดหน้าอาคาร", uri: `${APP_URL}/buildings` },
          style: "primary",
          color: "#1DB446",
        },
      ],
    },
  };
}

// สร้าง Flex Message สำหรับไม่พบข้อมูล
export function createNotFoundFlex(keyword: string): unknown {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🔍", size: "xl", align: "center" },
        { type: "text", text: `ไม่พบ "${keyword}"`, weight: "bold", size: "lg", align: "center", margin: "md" },
        { type: "text", text: "ลองค้นหาด้วยคำอื่น หรือตรวจสอบรหัสอีกครั้ง", size: "sm", color: "#999999", align: "center", margin: "md", wrap: true },
      ],
    },
  };
}
