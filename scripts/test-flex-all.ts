import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  searchPartsTool,
  getStockSummaryTool,
  getLowStockTool,
  getPartMovementsTool,
  getUsageTrendsTool,
  getPartDetailTool,
  listBuildingsTool,
  listBlocksTool,
} from "../src/lib/ai-assistant/db-tools";
import {
  createSearchResultsFlex,
  createStockSummaryFlex,
  createLowStockFlex,
  createPartDetailFlex,
  createPartMovementsFlex,
  createUsageTrendsFlex,
  createBuildingListFlex,
  createBlockListFlex,
  type FlexPart,
} from "../src/lib/line-chat/flex-messages";
import type { CleanPart } from "../src/lib/ai-assistant/db-tools";

function toFlexPart(p: CleanPart): FlexPart {
  return {
    id: "",
    partNumber: p.partNumber,
    partName: p.partName,
    quantity: p.quantity,
    minimumQuantity: p.minimumQuantity,
    unit: p.unit,
    location: p.location,
    plant: p.plant,
    imageUrl: null,
    category: p.categoryName ? { name: p.categoryName } : null,
    building: p.buildingName ? { name: p.buildingName } : null,
  };
}

async function run(label: string, fn: () => Promise<void>) {
  console.log(`\n========================================`);
  console.log(`TEST: ${label}`);
  try {
    await fn();
    console.log(`  ✓ OK`);
  } catch (err) {
    console.error(`  ✕ FAILED:`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  // 1. search_parts → Flex carousel
  await run("search_parts → createSearchResultsFlex", async () => {
    const result = await searchPartsTool({ keyword: "contactor", limit: 5 });
    console.log(`  parts: ${result.parts.length}, total: ${result.totalCount}`);
    const flex = createSearchResultsFlex(result.keyword, result.parts.map(toFlexPart));
    const type = (flex as Record<string, unknown>).type;
    const contents = (flex as { contents?: unknown[] }).contents;
    console.log(`  flex.type=${type}, contents=${Array.isArray(contents) ? contents.length : "n/a"}`);
  });

  // 2. get_stock_summary → Flex bubble
  await run("get_stock_summary → createStockSummaryFlex", async () => {
    const result = await getStockSummaryTool({ keyword: "contactor" });
    console.log(`  totalParts=${result.totalParts}, totalQty=${result.totalQuantity}`);
    const flex = createStockSummaryFlex(result, `("${result.keyword}")`);
    const type = (flex as Record<string, unknown>).type;
    console.log(`  flex.type=${type}`);
  });

  // 3. get_low_stock → Flex carousel
  await run("get_low_stock → createLowStockFlex", async () => {
    const result = await getLowStockTool({});
    console.log(`  totalCount=${result.totalCount}, parts=${result.parts.length}`);
    const flex = createLowStockFlex(result.parts.map(toFlexPart), result.totalCount);
    const type = (flex as Record<string, unknown>).type;
    const contents = (flex as { contents?: unknown[] }).contents;
    console.log(`  flex.type=${type}, contents=${Array.isArray(contents) ? contents.length : "n/a"}`);
  });

  // 4. get_part_detail → Flex bubble
  await run("get_part_detail → createPartDetailFlex", async () => {
    const part = await getPartDetailTool({ partNumber: "G7K-412S" });
    if (!part) {
      console.log(`  (no part found — trying first active part)`);
      const fallback = await prisma.part.findFirst({ where: { isActive: true } });
      if (!fallback) throw new Error("No parts in DB");
      const part2 = await getPartDetailTool({ partNumber: fallback.partNumber });
      if (!part2) throw new Error("getPartDetailTool returned null");
      const flex = createPartDetailFlex(toFlexPart(part2));
      console.log(`  flex.type=${(flex as Record<string, unknown>).type}, part=${part2.partNumber}`);
    } else {
      const flex = createPartDetailFlex(toFlexPart(part));
      console.log(`  flex.type=${(flex as Record<string, unknown>).type}, part=${part.partNumber}`);
    }
  });

  // 5. get_part_movements → Flex bubble
  await run("get_part_movements → createPartMovementsFlex", async () => {
    const result = await getPartMovementsTool({ limit: 10 });
    console.log(`  totalCount=${result.totalCount}, movements=${result.movements.length}, filters="${result.filters}"`);
    const flex = createPartMovementsFlex(result.movements, result.totalCount, result.filters);
    const type = (flex as Record<string, unknown>).type;
    console.log(`  flex.type=${type}`);
  });

  // 6. get_usage_trends → Flex bubble
  await run("get_usage_trends → createUsageTrendsFlex", async () => {
    const result = await getUsageTrendsTool({});
    console.log(`  monthly=${result.monthly.length}, summary="${result.summary.slice(0, 80)}"`);
    const flex = createUsageTrendsFlex(result.monthly, result.summary, result.filters);
    const type = (flex as Record<string, unknown>).type;
    console.log(`  flex.type=${type}`);
  });

  // 7. list_buildings → Flex bubble
  await run("list_buildings → createBuildingListFlex", async () => {
    const result = await listBuildingsTool();
    console.log(`  totalCount=${result.totalCount}`);
    const flex = createBuildingListFlex(result.buildings.map(b => ({ name: b.name, partCount: b.partCount })));
    const type = (flex as Record<string, unknown>).type;
    console.log(`  flex.type=${type}`);
  });

  // 8. list_blocks → Flex bubble
  await run("list_blocks → createBlockListFlex", async () => {
    const result = await listBlocksTool();
    console.log(`  totalCount=${result.totalCount}`);
    const flex = createBlockListFlex(result.blocks);
    const type = (flex as Record<string, unknown>).type;
    console.log(`  flex.type=${type}`);
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
