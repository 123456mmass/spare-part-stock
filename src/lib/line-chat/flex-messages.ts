// Flex Message templates for LINE Chat
// สร้าง Flex Messages ที่สวยงามสำหรับแสดงผลข้อมูลอะไหล่

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://spare.birdsphichitchai.dev";

type FlexPart = {
  id?: string;
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit?: string | null;
  location?: string | null;
  category?: { name: string } | null;
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

// สร้าง Flex Message สำหรับ help
export function createHelpFlex(): unknown {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🤖 ผู้ช่วยสต็อกอะไหล่",
          weight: "bold",
          size: "xl",
          color: "#1DB446",
        },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            { type: "text", text: "💬 พิมพ์ถามได้เลย เช่น:", size: "md", color: "#333333" },
            { type: "text", text: '• "contactor เหลือเท่าไหร่"', size: "sm", color: "#666666", margin: "sm" },
            { type: "text", text: '• "LC1D09 เหลือกี่ตัว"', size: "sm", color: "#666666" },
            { type: "text", text: '• "สรุปสต็อก"', size: "sm", color: "#666666" },
            { type: "text", text: '• "มีอาคารอะไรบ้าง"', size: "sm", color: "#666666" },
            { type: "text", text: '• "ค้นหา relay"', size: "sm", color: "#666666" },
            { type: "separator", margin: "md" },
            { type: "text", text: "📷 หรือส่งรูปภาพอะไหล่เพื่อค้นหา", size: "sm", color: "#1DB446", margin: "sm", weight: "bold" },
          ],
        },
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
            label: "เปิดเว็บแอป",
            uri: APP_URL,
          },
          style: "primary",
          color: "#1DB446",
        },
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
        contents: [
          { type: "text", text: `🔍 ค้นหา "${keyword}"`, weight: "bold", size: "lg" },
          { type: "text", text: "ไม่พบอะไหล่ที่ตรงกับคำค้น", size: "md", color: "#999999", margin: "md" },
        ],
      },
    };
  }

  const partBoxes = parts.map((p) => {
    const status =
      p.quantity <= 0 ? "❌ หมด" : p.quantity <= p.minimumQuantity ? "⚠️ ต่ำ" : "✅";
    const statusColor =
      p.quantity <= 0 ? "#FF0000" : p.quantity <= p.minimumQuantity ? "#FF9900" : "#1DB446";

    return {
      type: "box",
      layout: "vertical",
      margin: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: p.partNumber, size: "sm", weight: "bold", flex: 2 },
            { type: "text", text: `${p.quantity} ${p.unit || "pcs"}`, size: "sm", align: "end", flex: 1 },
          ],
        },
        { type: "text", text: p.partName, size: "xs", color: "#666666", margin: "xs" },
        {
          type: "box",
          layout: "horizontal",
          margin: "xs",
          contents: [
            { type: "text", text: status, size: "xs", color: statusColor },
            p.location
              ? { type: "text", text: `📍 ${p.location}`, size: "xs", color: "#999999", align: "end" }
              : { type: "filler" },
          ],
        },
        { type: "separator", margin: "sm" },
      ],
    };
  });

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: `🔍 ค้นหา "${keyword}"`, weight: "bold", size: "lg" },
        { type: "text", text: `พบ ${parts.length} รายการ`, size: "sm", color: "#999999", margin: "xs" },
        ...partBoxes,
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
            label: "ดูทั้งหมดในเว็บ",
            uri: `${APP_URL}/parts?search=${encodeURIComponent(keyword)}`,
          },
          style: "secondary",
        },
      ],
    },
  };
}

// สร้าง Flex Message สำหรับข้อมูลสต็อก
export function createStockInfoFlex(part: FlexPart): unknown {
  const status =
    part.quantity <= 0
      ? "❌ หมด"
      : part.quantity <= part.minimumQuantity
      ? "⚠️ ต่ำกว่าขั้นต่ำ"
      : "✅ คงเหลือ";
  const statusColor =
    part.quantity <= 0 ? "#FF0000" : part.quantity <= part.minimumQuantity ? "#FF9900" : "#1DB446";

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "📦", size: "xl" },
            { type: "text", text: part.partNumber, weight: "bold", size: "lg", margin: "sm", flex: 4 },
          ],
        },
        { type: "text", text: part.partName, size: "md", color: "#333333", margin: "sm" },
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
                { type: "text", text: "จำนวน", size: "sm", color: "#666666" },
                { type: "text", text: `${part.quantity} ${part.unit || "pcs"}`, size: "sm", weight: "bold", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "ขั้นต่ำ", size: "sm", color: "#666666" },
                { type: "text", text: `${part.minimumQuantity}`, size: "sm", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "สถานะ", size: "sm", color: "#666666" },
                { type: "text", text: status, size: "sm", weight: "bold", color: statusColor, align: "end" },
              ],
            },
            part.location
              ? {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ที่อยู่", size: "sm", color: "#666666" },
                    { type: "text", text: part.location, size: "sm", align: "end" },
                  ],
                }
              : null,
            part.category?.name
              ? {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "หมวด", size: "sm", color: "#666666" },
                    { type: "text", text: part.category.name, size: "sm", align: "end" },
                  ],
                }
              : null,
          ].filter(Boolean),
        },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
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
            uri: `${APP_URL}/scan`,
          },
          style: "secondary",
          flex: 1,
          margin: "sm",
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
