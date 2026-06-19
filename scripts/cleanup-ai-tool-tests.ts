import { prisma } from "../src/lib/prisma";

async function main() {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const deleted = await prisma.aiPendingAction.deleteMany({
    where: {
      status: "PENDING",
      createdAt: { gte: since },
      OR: [
        { summary: { contains: "AI tool test" } },
        { payloadJson: { contains: "TEST-AI-" } },
      ],
    },
  });
  console.log(`Deleted ${deleted.count} test pending action(s)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
