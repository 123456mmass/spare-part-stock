import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { orchestrate } from "../src/lib/line-chat/orchestrator";
import { buildAssistantMessages } from "../src/lib/line-chat/response-builder";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No active ADMIN user");

  const tests = [
    "contactor เหลือเท่าไหร่",
    "contactor ใน block 1 อาคาร ท.003",
    "มีอะไรใกล้หมด",
    "เบิก G7K-412S 2 ตัว",
  ];

  for (const text of tests) {
    console.log("\n========================================");
    console.log("USER:", text);
    const started = Date.now();
    const result = await orchestrate(
      admin.id,
      undefined,
      text,
      false,
      admin.role,
      "cli-test-user",
      false,
    );
    const ms = Date.now() - started;
    console.log(`tool: ${result.toolCalls?.[0]?.name ?? "none"} (${ms}ms)`);
    console.log("reply:", result.reply.slice(0, 200));

    const messages = buildAssistantMessages(result);
    console.log("\nmessages sent to LINE:");
    for (const [i, msg] of messages.entries()) {
      const type = (msg as Record<string, unknown>).type;
      if (type === "flex") {
        console.log(`  [${i}] FLEX altText:`, (msg as { altText?: string }).altText);
      } else {
        console.log(`  [${i}] ${type}:`, JSON.stringify(msg).slice(0, 200));
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
