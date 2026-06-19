import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
const prisma = new PrismaClient({ adapter });

// Row in Excel -> partNo mapping
// Row 1 = header (has an image but it's a title image, skip)
// Row 2-38 = data rows with partNo
const ROW_TO_PARTNO: Record<number, string> = {
  1: "__HEADER__", // skip
  2: "IRDH275B-435",
  3: "IRDH275-427",
  4: "7PA22410",
  5: "7PA22510",
  6: "AC-22B",
  7: "7XP9010-1",
  8: "PRS21N01BH",
  9: "A9A26919",
  10: "611",
  11: "1029",
  12: "RS-NBK2-001",     // no partNo in Excel, assigned
  13: "A038302",
  14: "RA4088/801",
  15: "SG1501446-016",
  16: "2CSF423005D1002",
  17: "A038327",
  18: "Lot.0159",
  19: "RCT-NBK2-001",    // no partNo in Excel, assigned
  20: "1025",
  21: "CS30323",
  22: "12D9",
  23: "H3CR",
  24: "RF4XR",
  25: "05199554C",
  26: "2CDS273001R0064",
  27: "GM-MCSC1000SM",
  28: "AC-22B",          // duplicate partNo - will merge with row 6
  29: "ACVT03",
  30: "3300/078",
  31: "YSBPL2-AL11",
  32: "YSBRL34-DL22",
  33: "CT30",
  34: "4121041062",
  35: "4121061203",
  36: "RF4",
  37: "RD2DI",
  38: "3ZX10-12-0RH11-1AA1",
};

const UPLOADS_DIR = "/var/www/spare-part-stock/public/uploads/parts";
const IMAGES_DIR = "/root/nbk2_images_resized"; // where we scp'd the images

async function main() {
  console.log("=== Update NBK2 part images ===\n");

  let updated = 0;
  let skipped = 0;

  for (const [rowStr, partNo] of Object.entries(ROW_TO_PARTNO)) {
    const row = Number(rowStr);
    if (partNo === "__HEADER__") {
      console.log(`Row ${row}: skip header image`);
      skipped++;
      continue;
    }

    // Find the part in DB
    const part = await prisma.part.findUnique({ where: { partNumber: partNo } });
    if (!part) {
      console.log(`Row ${row}: partNo=${partNo} NOT FOUND in DB, skip`);
      skipped++;
      continue;
    }

    // Already has image?
    if (part.imageUrl) {
      console.log(`Row ${row}: ${partNo} already has image (${part.imageUrl}), skip`);
      skipped++;
      continue;
    }

    // Find image file: row_XX.jpg
    const rowPadded = String(row).padStart(2, "0");
    const imgPath = path.join(IMAGES_DIR, `row_${rowPadded}.jpg`);

    if (!fs.existsSync(imgPath)) {
      console.log(`Row ${row}: ${partNo} - no image file at ${imgPath}`);
      skipped++;
      continue;
    }

    // Read image and compute hash for filename (match existing pattern: {partId}-{hash}.jpg)
    const imgBuf = fs.readFileSync(imgPath);
    const hash = crypto.createHash("md5").update(imgBuf).digest("hex").slice(0, 8);
    const newFilename = `${part.id}-${hash}.jpg`;
    const newPath = path.join(UPLOADS_DIR, newFilename);

    // Copy image to uploads with new name
    fs.writeFileSync(newPath, imgBuf);

    // Update DB
    const imageUrl = `/uploads/parts/${newFilename}`;
    await prisma.part.update({
      where: { id: part.id },
      data: { imageUrl },
    });

    console.log(`Row ${row}: ${partNo} -> ${imageUrl} (${Math.round(imgBuf.length / 1024)}KB)`);
    updated++;
  }

  console.log(`\n=== Done: ${updated} images updated, ${skipped} skipped ===`);

  // Verify
  const partsWithImages = await prisma.part.findMany({
    where: { buildingId: (await prisma.building.findFirst({ where: { name: "ท.021" } }))!.id },
    select: { partNumber: true, partName: true, imageUrl: true },
  });
  const withImg = partsWithImages.filter(p => p.imageUrl).length;
  const withoutImg = partsWithImages.filter(p => !p.imageUrl).length;
  console.log(`Parts in ท.021: ${partsWithImages.length} (with image: ${withImg}, without: ${withoutImg})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
