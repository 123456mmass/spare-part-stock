import {
  draftAdjustStock,
  draftCreatePart,
  draftStockIn,
  draftStockOut,
  draftUpdatePartLocation,
  formatPendingActionForChat,
} from "./pending-actions";
import { executeTool as executeInventoryReadTool } from "@/lib/line-chat/tools";
import {
  searchPartsTool,
  getStockSummaryTool,
  getLowStockTool,
  getPartMovementsTool,
  getUsageTrendsTool,
  getPartDetailTool,
  listBuildingsTool,
  listBlocksTool,
  searchByImageTool,
} from "./db-tools";
import { webSearchTool, isWebSearchEnabled } from "./web-search";
import { renderWebSearchText } from "./text-renderers";
import type { ToolExecutionContext } from "./types";

export const AI_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_parts",
      description: "ค้นหาอะไหล่จากชื่อ รหัส ตำแหน่ง อาคาร หรือ Block (ใช้เมื่อผู้ใช้พูด หา/ค้นหา/มี...ไหม) อย่าใช้คู่กับ get_stock_summary",
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
      description: "สรุปสถานะสต็อกตามตัวกรอง (plant, buildingName, categoryName, keyword) คืนจำนวนทั้งหมด, จำนวนรวม, คงเหลือ, ต่ำกว่าขั้นต่ำ, หมด แยกตาม building และ plant (ใช้เมื่อผู้ใช้ถาม สถานะ/เหลือเท่าไหร่/มีกี่ตัว/สรุป/ภาพรวมของอะไหล่ประเภทหนึ่ง เช่น สถานะเบรกเกอร์ หรือ contactor เหลือเท่าไหร่ โดยส่ง keyword เป็นชื่ออะไหล่เข้าไป) อย่าใช้คู่กับ search_parts",
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

// Web search tool — only included when TAVILY_API_KEY is set
const WEB_SEARCH_TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "ค้นหาข้อมูลจากเว็บภายนอก ใช้เฉพาะเมื่อผู้ใช้ขอค้นจากอินเทอร์เน็ต/ผู้จำหน่ำยโดยชัดเจรเท่านั้น (เช่น 'ค้นเว็บหา', 'หาผู้จำหน่ำยจากเน็ต') ห้ามใช้แทนการค้นในคลัง หาก search_parts ไม่พบให้บอกว่าไม่พบในระบบ",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "คำค้นหา เช่น 'PTC sensor Siemens 3RN2010' หรือ 'motor protection relay recommendation'" },
        maxResults: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["query"],
    },
  },
};

// Single-tool router for fast LLM tool calling on providers like Umans
// that slow down significantly with multiple tools (> 1s per tool).
const INVENTORY_TOOL_DEF = {
  type: "function" as const,
  function: {
    name: "inventory_operation",
    description: "เรียกคำสั่งสต็อกอะไหล่ทั้งหมด: ค้นหา สรุป ใกล้หมด รายละเอียด อาคาร บล็อก ประวัติ แนวโน้ม ค้นเว็บ หรือร่าง action (รับเข้า เบิกออก ปรับยอด ย้าย สร้าง)",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: [
            "search", "summary", "low_stock", "detail", "buildings", "blocks", "movements", "trends", "web_search",
            "draft_stock_in", "draft_stock_out", "draft_adjust_stock", "draft_update_part_location", "draft_create_part",
          ],
          description: "ประเภทคำถาม/action",
        },
        keyword: { type: "string", description: "คำค้นหา/รหัสอะไหล่" },
        partNumber: { type: "string", description: "รหัสอะไหล่ (สำหรับ detail/action)" },
        plant: { type: "string", description: "Block เช่น 1, 2, SPECIAL PART" },
        buildingName: { type: "string", description: "ชื่ออาคาร เช่น ท.003" },
        buildingId: { type: "string" },
        categoryName: { type: "string" },
        location: { type: "string", description: "ตำแหน่งใหม่ (สำหรับ update_part_location)" },
        qty: { type: "integer", minimum: 1, description: "จำนวน (stock_in/stock_out)" },
        newQty: { type: "integer", minimum: 0, description: "จำนวนใหม่ (adjust_stock)" },
        quantity: { type: "integer", minimum: 0 },
        minimumQuantity: { type: "integer", minimum: 0 },
        unit: { type: "string" },
        partName: { type: "string" },
        description: { type: "string" },
        subcategory: { type: "string" },
        barcodeValue: { type: "string" },
        note: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 },
      },
      required: ["intent"],
    },
  },
};

export function getAiToolDefinitions() {
  if (isWebSearchEnabled()) {
    return [...AI_TOOL_DEFINITIONS, WEB_SEARCH_TOOL_DEF];
  }
  return AI_TOOL_DEFINITIONS;
}

export function getSingleReadToolDefinitions() {
  return [INVENTORY_TOOL_DEF];
}

export function getSingleDraftToolDefinitions() {
  return [INVENTORY_TOOL_DEF];
}

export function getAllInventoryToolDefinitions() {
  return [INVENTORY_TOOL_DEF];
}
const DRAFT_TOOL_NAMES = new Set([
  "draft_stock_in",
  "draft_stock_out",
  "draft_adjust_stock",
  "draft_update_part_location",
  "draft_create_part",
]);

export function getReadToolDefinitions() {
  // Core read tools — keep under 6 to avoid LLM reasoning timeout.
  // Removed from LLM tool list (still callable via pre-router):
  //   get_stock, get_stock_stats, list_blocks, search_by_image,
  //   get_part_movements, get_usage_trends
  // These are handled by deterministic routing or called less frequently.
  const coreNames = new Set([
    "search_parts",
    "get_stock_summary",
    "get_low_stock",
    "get_part_detail",
    "list_buildings",
  ]);
  const base = AI_TOOL_DEFINITIONS.filter((t) =>
    coreNames.has(t.function.name),
  );
  if (isWebSearchEnabled()) {
    return [...base, WEB_SEARCH_TOOL_DEF];
  }
  return base;
}

/**
 * Context-aware tool selection: add niche tools only when the message
 * likely needs them. Keeps the tool count low (fast LLM) while still
 * supporting image search, movements, trends, and blocks when relevant.
 */
export function getReadToolDefinitionsForMessage(message: string) {
  const tools = getReadToolDefinitions();
  const text = message.toLowerCase();

  const extraNames = new Set<string>();
  if (/(บล็อก|บล็อค|block)/i.test(text) && !/(ค้นหา|หา|เช็ค)/i.test(text)) {
    extraNames.add("list_blocks");
  }
  if (/(ประวัติ|เคลื่อนไหว|รับเข้า|เบิกออก|movement)/i.test(text)) {
    extraNames.add("get_part_movements");
  }
  if (/(แนวโน้ม|เทรนด์|trend|สถิติการใช้)/i.test(text)) {
    extraNames.add("get_usage_trends");
  }
  // search_by_image is triggered by attachments, not text — handled separately

  if (extraNames.size === 0) return tools;

  const extra = AI_TOOL_DEFINITIONS.filter((t) =>
    extraNames.has(t.function.name),
  );
  // Keep total under 8 to stay fast
  return [...tools, ...extra].slice(0, 8);
}

export function getDraftToolDefinitions() {
  return AI_TOOL_DEFINITIONS.filter((t) =>
    DRAFT_TOOL_NAMES.has(t.function.name),
  );
}

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
  // Single-tool router: expand into concrete db-tools
  if (name === "inventory_operation") {
    const intent = typeof args.intent === "string" ? args.intent : "";
    const keyword = typeof args.keyword === "string" ? args.keyword : null;
    const partNumber = typeof args.partNumber === "string" ? args.partNumber : null;
    const plant = typeof args.plant === "string" ? args.plant : null;
    const buildingName = typeof args.buildingName === "string" ? args.buildingName : null;
    const limit = typeof args.limit === "number" ? args.limit : null;

    switch (intent) {
      case "search": {
        const result = await searchPartsTool({ keyword, plant, buildingName, limit });
        return { content: JSON.stringify(result), result };
      }
      case "summary": {
        const result = await getStockSummaryTool({ keyword, plant, buildingName, limit });
        return { content: JSON.stringify(result), result };
      }
      case "low_stock": {
        const result = await getLowStockTool({ keyword, plant, buildingName, limit });
        return { content: JSON.stringify(result), result };
      }
      case "detail": {
        const result = await getPartDetailTool({ partNumber: partNumber || keyword });
        return { content: JSON.stringify(result), result };
      }
      case "buildings": {
        const result = await listBuildingsTool();
        return { content: JSON.stringify(result), result };
      }
      case "blocks": {
        const result = await listBlocksTool();
        return { content: JSON.stringify(result), result };
      }
      case "movements": {
        const result = await getPartMovementsTool({ keyword, from: null, to: null, limit });
        return { content: JSON.stringify(result), result };
      }
      case "trends": {
        const result = await getUsageTrendsTool({ keyword, from: null, to: null, limit });
        return { content: JSON.stringify(result), result };
      }
      case "draft_stock_in":
      case "draft_stock_out":
      case "draft_adjust_stock":
      case "draft_update_part_location":
      case "draft_create_part": {
        // single-router draft action
        if (!context.user?.id || context.user.id === "anonymous") {
          return {
            content:
              "⚠️ การแก้ไขสต็อกต้องเชื่อมต่อบัญชีผู้ใช้กับ LINE ก่อน กรุณากดปุ่ม Login / Link Account แล้วลองใหม่",
          };
        }
        const draftAction =
          intent === "draft_stock_in"
            ? await draftStockIn(context, args)
            : intent === "draft_stock_out"
            ? await draftStockOut(context, args)
            : intent === "draft_adjust_stock"
            ? await draftAdjustStock(context, args)
            : intent === "draft_update_part_location"
            ? await draftUpdatePartLocation(context, args)
            : await draftCreatePart(context, args);
        return {
          content: formatPendingActionForChat(draftAction),
          pendingActionId: draftAction.id,
        };
      }
      case "web_search": {
        const result = await webSearchTool({ query: keyword, maxResults: limit });
        return { content: renderWebSearchText(result), result };
      }
      default: {
        return { content: `{"error":"ไม่รู้จัก intent: ${intent}"}` };
      }
    }
  }

  // New read tools — handle directly with db-tools (returns structured JSON)
  if (name === "search_parts") {
    const result = await searchPartsTool(dbToolInput(args));
    return { content: JSON.stringify(result), result };
  }
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
    const result = await getPartDetailTool({
      partNumber: typeof args.partNumber === "string" ? args.partNumber : null,
    });
    return { content: JSON.stringify(result), result };
  }
  if (name === "list_buildings") {
    const result = await listBuildingsTool();
    return { content: JSON.stringify(result), result };
  }
  if (name === "list_blocks") {
    const result = await listBlocksTool();
    return { content: JSON.stringify(result), result };
  }
  if (name === "search_by_image") {
    const result = await searchByImageTool({
      imageBase64: typeof args.imageBase64 === "string" ? args.imageBase64 : null,
    });
    return { content: JSON.stringify(result), result };
  }
  if (name === "web_search") {
    const result = await webSearchTool({
      query: typeof args.query === "string" ? args.query : null,
      maxResults: typeof args.maxResults === "number" ? args.maxResults : null,
    });
    return { content: renderWebSearchText(result), result };
  }

  if (name === "inventory_action") {
    const action = typeof args.action === "string" ? args.action : "";
    console.log("[inventory_action] action:", action, "args:", Object.keys(args));

    // Require a real linked user for any DB-mutating draft action.
    if (!context.user?.id || context.user.id === "anonymous") {
      return {
        content:
          "⚠️ การแก้ไขสต็อกต้องเชื่อมต่อบัญชีผู้ใช้กับ LINE ก่อน กรุณากดปุ่ม Login / Link Account แล้วลองใหม่",
      };
    }

    const draftAction =
      action === "draft_stock_in"
        ? await draftStockIn(context, args)
        : action === "draft_stock_out"
        ? await draftStockOut(context, args)
        : action === "draft_adjust_stock"
        ? await draftAdjustStock(context, args)
        : action === "draft_update_part_location"
        ? await draftUpdatePartLocation(context, args)
        : action === "draft_create_part"
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

  if (READ_TOOL_NAMES.has(name)) {
    return {
      content: await executeInventoryReadTool(name, stringifyArgs(args)),
    };
  }

  // Fallback: legacy individual draft tool names (kept for backward compatibility).
  if (DRAFT_TOOL_NAMES.has(name)) {
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

  return { content: `Tool "${name}" ไม่รู้จัก` };
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
