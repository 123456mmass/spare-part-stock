/**
 * Build LINE reply messages from an orchestrator result.
 *
 * Produces a natural text message from the LLM reply plus a structured Flex
 * card when a read tool was invoked and we have a matching visual renderer.
 */

import { createTextMessage, createFlexMessage } from "@/lib/line";
import {
  createSearchResultsFlex,
  createStockSummaryFlex,
  createLowStockFlex,
} from "@/lib/line-chat/flex-messages";
import type {
  SearchPartsResult,
  StockSummaryResult,
  LowStockResult,
} from "@/lib/ai-assistant/db-tools";
import type { AssistantToolCall, AiAssistantResult } from "@/lib/ai-assistant/types";

type LineMessage =
  | ReturnType<typeof createTextMessage>
  | ReturnType<typeof createFlexMessage>;

export function buildAssistantMessages(
  result: AiAssistantResult,
): LineMessage[] {
  const messages: LineMessage[] = [createTextMessage(result.reply)];

  const flex = buildFlexForToolCalls(result.toolCalls);
  if (flex) {
    messages.push(createFlexMessage(flex.altText, flex.contents));
  }

  return messages;
}

function buildFlexForToolCalls(toolCalls?: AssistantToolCall[]): {
  altText: string;
  contents: unknown;
} | null {
  if (!toolCalls || toolCalls.length === 0) return null;

  // Prefer the most specific read tool if multiple were called.
  const main = toolCalls.find((t) =>
    ["get_stock_summary", "search_parts", "get_low_stock"].includes(t.name),
  ) ?? toolCalls[toolCalls.length - 1];

  switch (main.name) {
    case "get_stock_summary": {
      const data = main.result as StockSummaryResult | undefined;
      if (!data) return null;
      const filters: string[] = [];
      if (data.plant) filters.push(`บล็อค ${data.plant}`);
      if (data.buildingName) filters.push(`อาคาร ${data.buildingName}`);
      if (data.categoryName) filters.push(data.categoryName);
      if (data.keyword) filters.push(`"${data.keyword}"`);
      const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";
      return {
        altText: `สรุปสต็อก${filterText}`,
        contents: createStockSummaryFlex(data, filterText),
      };
    }

    case "search_parts": {
      const data = main.result as SearchPartsResult | undefined;
      if (!data) return null;
      const flexParts = data.parts.map((p) => ({
        id: "", // search result does not expose DB id for detail link
        partNumber: p.partNumber,
        partName: p.partName,
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        location: p.location,
        plant: p.plant,
        category: p.categoryName ? { name: p.categoryName } : null,
        building: p.buildingName ? { name: p.buildingName } : null,
      }));
      return {
        altText: `ค้นหา ${data.keyword}`,
        contents: createSearchResultsFlex(data.keyword, flexParts),
      };
    }

    case "get_low_stock": {
      const data = main.result as LowStockResult | undefined;
      if (!data) return null;
      const flexParts = data.parts.map((p) => ({
        id: "",
        partNumber: p.partNumber,
        partName: p.partName,
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        location: p.location,
        plant: p.plant,
        category: p.categoryName ? { name: p.categoryName } : null,
        building: p.buildingName ? { name: p.buildingName } : null,
      }));
      return {
        altText: `อะไหล่ต่ำกว่าขั้นต่ำ (${data.totalCount} รายการ)`,
        contents: createLowStockFlex(flexParts, data.totalCount),
      };
    }

    default:
      return null;
  }
}
