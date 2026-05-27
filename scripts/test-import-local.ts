import { importPartsFromExcel } from "../src/lib/excel";
import { prisma } from "../src/lib/prisma";
import fs from "fs";

async function run() {
  const filePath = process.argv[2] || "C:\\Users\\qwert\\Downloads\\ไฟล์ Spare part.xlsx";
  const buf = fs.readFileSync(filePath);
  console.log("File:", (buf.length / 1024 / 1024).toFixed(0), "MB");

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("No admin user found");
    process.exit(1);
  }
  console.log("Admin:", admin.name);

  const start = Date.now();
  console.log("Importing...");
  const result = await importPartsFromExcel(buf, admin.id);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n=== Result (${elapsed}s) ===`);
  console.log(JSON.stringify(result, null, 2));

  // Show sample
  const parts = await prisma.part.findMany({
    where: { plant: "2" },
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
  console.log("\nSample parts (plant=2):");
  for (const p of parts) {
    console.log(
      " ",
      p.partNumber,
      "|",
      (p.partName || "").substring(0, 35),
      "| qty:",
      p.quantity,
      "| cat:",
      p.category?.name || "-",
      "| img:",
      p.imageUrl ? "YES" : "no"
    );
  }

  const total = await prisma.part.count({ where: { plant: "2" } });
  console.log("\nTotal parts with plant=2:", total);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
