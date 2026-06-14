import { executeTool as executeInventoryReadTool } from "@/lib/line-chat/tools";
import {
  draftAdjustStock,
  draftCreatePart,
  draftStockIn,
  draftStockOut,
  draftUpdatePartLocation,
  formatPendingActionForChat,
} from "./pending-actions";
import {
  searchPartsTool,
  getStockSummaryTool,
  getLowStockTool,
  getPartMovementsTool,
  getUsageTrendsTool,
} from "./db-tools";
import type { ToolExecutionContext } from "./types";

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_parts",
      description: "ค้นหาอะไหล่จากชื่อ รหัส ตำแหน่ง อาคาร หรือ Block",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          buildingId: { type: "string" },
          building: { type: "string" },
          plant: { type: "string" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock",
      description: "ดูจำนวนสต็อกของอะไหล่จากรหัสอะไหล่หรือบาร์โค้ด",
      parameters: {
        type: "object",
        properties: { code: { type: "string" } },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_stats",
      description: "ดูสถิติสต็อกโดยรวม",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_buildings",
      description: "ดูรายการอาคารทั้งหมด",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_blocks",
      description: "ดูรายการ Block ทั้งหมด",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_by_image",
      description: "ค้นหาอะไหล่ที่คล้ายรูปภาพจาก imageBase64",
      parameters: {
        type: "object",
        properties: { imageBase64: { type: "string" } },
        required: ["imageBase64"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_summary",
      description: "สรุปสถานะสต็อกตามตัวกรอง (plant, buildingName, categoryName) คืนจำนวนทั้งหมด, คงเหลือ, ต่ำกว่าขั้นต่ำ, หมด",
      parameters: {
        type: "object",
        properties: {
          plant: { type: "string", description: "เช่น '1', '2', 'SPECIAL PART'" },
          buildingName: { type: "string", description: "เช่น 'ท.003', 'ท.021'" },
          categoryName: { type: "string" },
          keyword: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_low_stock",
      description: "ดูอะไหล่ที่ใกล้หมดหรือต่ำกว่าขั้นต่ำ",
      parameters: {
        type: "object",
        properties: {
          plant: { type: "string" },
          buildingName: { type: "string" },
          categoryName: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_part_movements",
      description: "ประวัติการเบิก/รับ/ปรับสต็อกล่าสุด",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          plant: { type: "string" },
          buildingName: { type: "string" },
          categoryName: { type: "string" },
          from: { type: "string", description: "ISO date" },
          to: { type: "string", description: "ISO date" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_usage_trends",
      description: "สถิติการเบิก/รับแยกตามเดือน พร้อมสรุป",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          plant: { type: "string" },
          buildingName: { type: "string" },
          categoryName: { type: "string" },
          from: { type: "string", description: "ISO date" },
          to: { type: "string", description: "ISO date" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_part_detail",
      description: "ดูรายละเอียดอะไหล่จากรหัส partNumber",
      parameters: {
        type: "object",
        properties: { partNumber: { type: "string" } },
        required: ["partNumber"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_stock_in",
      description: "สร้างรายการรอยืนยันสำหรับรับอะไหล่เข้า ไม่เขียน DB จนกว่าผู้ใช้ยืนยัน",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          qty: { type: "integer", minimum: 1 },
          note: { type: "string" },
        },
        required: ["partNumber", "qty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_stock_out",
      description: "สร้างรายการรอยืนยันสำหรับเบิกอะไหล่ออก ต้องกัน stock ติดลบ",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          qty: { type: "integer", minimum: 1 },
          note: { type: "string" },
        },
        required: ["partNumber", "qty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_adjust_stock",
      description: "ADMIN เท่านั้น สร้างรายการรอยืนยันสำหรับปรับยอดคงเหลือ",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          newQty: { type: "integer", minimum: 0 },
          note: { type: "string" },
        },
        required: ["partNumber", "newQty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_update_part_location",
      description: "ADMIN เท่านั้น สร้างรายการรอยืนยันสำหรับแก้ตำแหน่งอะไหล่",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          location: { type: "string" },
          note: { type: "string" },
        },
        required: ["partNumber", "location"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "draft_create_part",
      description: "ADMIN เท่านั้น สร้างรายการรอยืนยันสำหรับสร้างอะไหล่ใหม่",
      parameters: {
        type: "object",
        properties: {
          partNumber: { type: "string" },
          partName: { type: "string" },
          description: { type: "string" },
          categoryId: { type: "string" },
          buildingId: { type: "string" },
          subcategory: { type: "string" },
          plant: { type: "string" },
          location: { type: "string" },
          quantity: { type: "integer", minimum: 0 },
          minimumQuantity: { type: "integer", minimum: 0 },
          unit: { type: "string" },
          barcodeValue: { type: "string" },
          note: { type: "string" },
        },
        required: ["partNumber", "partName", "buildingId", "plant", "quantity", "minimumQuantity", "unit"],
      },
    },
  },
];

const READ_TOOL_NAMES = new Set([
  "search_parts",
  "get_stock",
  "get_stock_stats",
  "list_buildings",
  "list_blocks",
  "search_by_image",
  "get_stock_summary",
  "get_low_stock",
  "get_part_movements",
  "get_usage_trends",
  "get_part_detail",
]);

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<{ content: string; result?: unknown; pendingActionId?: string }> {
  // New read tools — handle directly with db-tools (returns structured JSON)
  if (name === "get_stock_summary") {
    const result = await getStockSummaryTool(dbToolInput(args));
    return { content: JSON.stringify(result), result };
  }
  if (name === "get_low_stock") {
    const result = await getLowStockTool(dbToolInput(args));
    return { content: JSON.stringify(result), result };
  }
  if (name === "get_part_movements") {
    const result = await getPartMovementsTool(dbToolInput(args));
    return { content: JSON.stringify(result), result };
  }
  if (name === "get_usage_trends") {
    const result = await getUsageTrendsTool(dbToolInput(args));
    return { content: JSON.stringify(result), result };
  }
  if (name === "get_part_detail") {
    const result = await searchPartsTool({ ...dbToolInput(args), limit: 1 });
    return { content: JSON.stringify(result), result };
  }

  // Existing read tools — delegate to inventory executor
  if (READ_TOOL_NAMES.has(name)) {
    return {
      content: await executeInventoryReadTool(name, stringifyArgs(args)),
    };
  }

    // Require a real linked user for any DB-mutating draft action.
  if (!context.user?.id || context.user.id === "anonymous") {
    return {
      content:
        "⚠️ การแก้ไขสต็อกต้องเชื่อมต่อบัญชีผู้ใช้กับ LINE ก่อน กรุณากดปุ่ม Login / Link Account แล้วลองใหม่",
    };
  }

  const draftAction =
    name === "draft_stock_in"
      ? await draftStockIn(context, args)
      : name === "draft_stock_out"
      ? await draftStockOut(context, args)
      : name === "draft_adjust_stock"
      ? await draftAdjustStock(context, args)
      : name === "draft_update_part_location"
      ? await draftUpdatePartLocation(context, args)
      : name === "draft_create_part"
      ? await draftCreatePart(context, args)
      : null;

  if (!draftAction) {
    return { content: `Tool "${name}" ไม่รู้จัก` };
  }

  return {
    content: formatPendingActionForChat(draftAction),
    pendingActionId: draftAction.id,
  };
}

function stringifyArgs(args: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") output[key] = value;
    else if (value !== undefined && value !== null) output[key] = String(value);
  }
  return output;
}

function dbToolInput(args: Record<string, unknown>) {
  return {
    keyword: typeof args.keyword === "string" ? args.keyword : null,
    plant: typeof args.plant === "string" ? args.plant : null,
    buildingName: typeof args.buildingName === "string" ? args.buildingName : null,
    buildingId: typeof args.buildingId === "string" ? args.buildingId : null,
    categoryName: typeof args.categoryName === "string" ? args.categoryName : null,
    limit: typeof args.limit === "number" ? args.limit : null,
    from: typeof args.from === "string" ? args.from : null,
    to: typeof args.to === "string" ? args.to : null,
  };
}
