import "dotenv/config";
import { executeAiTool } from "../src/lib/ai-assistant/tools";
import { buildAssistantMessages } from "../src/lib/line-chat/response-builder";
import { prisma } from "../src/lib/prisma";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
  });
  if (!admin) throw new Error("no admin");
  const ctx = { user: { id: admin.id, role: admin.role, name: admin.name }, channel: "web" as const };

  const cases = [
    { name: "get_stock_summary", args: { keyword: "contactor", limit: 5 } },
    { name: "search_parts", args: { keyword: "contactor", limit: 3 } },
    { name: "get_low_stock", args: { limit: 3 } },
  ] as const;

  for (const c of cases) {
    const started = Date.now();
    const toolResult = await executeAiTool(c.name, c.args, ctx);
    const messages = buildAssistantMessages({
      reply: toolResult.content,
      pendingActionIds: [],
      toolCalls: [
        {
          name: c.name,
          arguments: c.args as Record<string, unknown>,
          result: toolResult.result,
        },
      ],
    });
    console.log(`${c.name}: ${Date.now() - started}ms →`, messages.map((m) => (m as { type?: string }).type));
  }
  await prisma.$disconnect();
}

main();
