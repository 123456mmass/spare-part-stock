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
  return LIFF_ID ? `${APP_URL}/liff/${path}` : `${APP_URL}/liff/${path}`;
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
