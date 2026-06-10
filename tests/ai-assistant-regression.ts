import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { AI_TOOL_DEFINITIONS, executeAiTool } from "@/lib/ai-assistant/tools";
import { cancelPendingAction } from "@/lib/ai-assistant/pending-actions";

async function main() {
  const toolNames = AI_TOOL_DEFINITIONS.map((tool) => tool.function.name);
  assert.deepEqual(
    [
      "search_parts",
      "get_stock",
      "get_stock_stats",
      "list_buildings",
      "list_blocks",
      "search_by_image",
      "draft_stock_in",
      "draft_stock_out",
      "draft_adjust_stock",
      "draft_update_part_location",
      "draft_create_part",
    ].every((name) => toolNames.includes(name)),
    true
  );

  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(user, "expected at least one active user");

  const part = await prisma.part.findFirst({
    where: { isActive: true, quantity: { gt: 0 } },
    orderBy: { partNumber: "asc" },
  });
  assert.ok(part, "expected at least one stocked part");

  const before = part.quantity;
  const result = await executeAiTool(
    "draft_stock_out",
    { partNumber: part.partNumber, qty: 1, note: "regression draft only" },
    { user: { id: user.id, role: user.role, name: user.name }, channel: "service" }
  );

  assert.ok(result.pendingActionId, "draft_stock_out should create pending action");
  assert.match(result.content, /ยืนยัน/);

  await cancelPendingAction({ id: result.pendingActionId, userId: user.id });

  const after = await prisma.part.findUniqueOrThrow({
    where: { id: part.id },
    select: { quantity: true },
  });
  assert.equal(after.quantity, before, "draft action must not mutate stock");

  await prisma.$disconnect();
}

main().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exit(1);
});
