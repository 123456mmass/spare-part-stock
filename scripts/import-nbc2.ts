/**
 * One-shot import script for "ไฟล์ Spare part.xlsx" sheet NBC2
 *
 * Column mapping:
 *   B (2) = No.
 *   C (3) = Plant → block/plant field
 *   D (4) = System → category
 *   E (5) = Type → partNumber (if empty, generate from row#)
 *   F (6) = Material Description → partName
 *   G (7) = Location → location
 *   H (8) = Unit → unit
 *   I (9) = Stock On Hand → quantity
 *   Images at col ~11 → image
 *
 * Usage: npx tsx scripts/import-nbc2.ts [path-to-file]
 */

import ExcelJS from "exceljs";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../src/lib/prisma";
import { generateQRCode } from "../src/lib/qrcode";
import { generatePartBarcodeValue } from "../src/lib/barcode";

const IMAGES_DIR = path.join(process.cwd(), "public", "uploads", "images");
const PLANT_OVERRIDE = "2";

interface ParsedRow {
  rowNum: number;
  partNumber: string;
  partName: string;
  category?: string;
  location?: string;
  unit: string;
  quantity: number;
  plant: string;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function processImage(buffer: Buffer, partNumber: string): Promise<string | null> {
  await ensureDir(IMAGES_DIR);
  const sanitized = partNumber.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${sanitized}.webp`;
  const filePath = path.join(IMAGES_DIR, fileName);
  try {
    await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filePath);
    return `/uploads/images/${fileName}`;
  } catch (e) {
    console.error(`  [IMG FAIL] ${partNumber}:`, (e as Error).message);
    return null;
  }
}

async function main() {
  const filePath = process.argv[2] || "C:\\Users\\qwert\\Downloads\\ไฟล์ Spare part.xlsx";

  console.log(`Loading: ${filePath}`);
  const start = Date.now();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  console.log(`Loaded in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  const ws = wb.getWorksheet("NBC2");
  if (!ws) {
    console.error("Sheet 'NBC2' not found!");
    process.exit(1);
  }

  console.log(`Sheet NBC2: ${ws.rowCount} rows, ${ws.columnCount} cols`);

  // Extract images — build row→buffer map
  const sheetImages = ws.getImages();
  const imageMap = new Map<number, Buffer>();

  for (const img of sheetImages) {
    const mediaItem = wb.model.media[Number(img.imageId)];
    if (!mediaItem) continue;
    const buffer = Buffer.from(mediaItem.buffer as ArrayBuffer);
    if (!buffer || buffer.length === 0) continue;
    const rowIdx = Math.round((img.range as any)?.tl?.row ?? 0) + 1;
    imageMap.set(rowIdx, buffer);
  }
  console.log(`Images extracted: ${imageMap.size}`);

  // Parse rows (header at row 2, data starts row 3)
  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const no = row.getCell(2).text?.toString().trim();
    if (!no) continue; // skip empty rows

    const plant = row.getCell(3).text?.toString().trim() || PLANT_OVERRIDE;
    const system = row.getCell(4).text?.toString().trim() || undefined;
    const type = row.getCell(5).text?.toString().trim() || "";
    const description = row.getCell(6).text?.toString().trim() || "";
    const location = row.getCell(7).text?.toString().trim() || undefined;
    const unit = row.getCell(8).text?.toString().trim() || "EA";
    const stockText = row.getCell(9).text?.toString().trim() || "0";

    // partName is required
    if (!description) {
      skipped++;
      continue;
    }

    // Generate partNumber from Type, or from row number if empty
    const partNumber = type || `NBC2-${no.padStart(4, "0")}`;

    // Parse quantity — handle non-numeric like "1ม้วน" → extract leading number
    const qtyMatch = stockText.match(/^(\d+)/);
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;

    rows.push({
      rowNum: r,
      partNumber,
      partName: description,
      category: system || undefined,
      location,
      unit,
      quantity,
      plant,
    });
  }

  console.log(`\nParsed: ${rows.length} rows (skipped ${skipped} empty)`);
  console.log(`Plant override: ${PLANT_OVERRIDE}`);

  // Get admin user for createdBy
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.error("No admin user found! Run admin:create first.");
    process.exit(1);
  }

  // Pre-resolve categories
  const categoryNames = [...new Set(rows.map(r => r.category).filter(Boolean))] as string[];
  const categoryMap = new Map<string, string>();
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    categoryMap.set(name, cat.id);
  }
  console.log(`Categories resolved: ${categoryMap.size}`);

  // Check existing parts
  const existingParts = await prisma.part.findMany({
    where: { partNumber: { in: rows.map(r => r.partNumber) } },
    select: { id: true, partNumber: true },
  });
  const existingMap = new Map(existingParts.map(p => [p.partNumber, p.id]));
  console.log(`Existing parts found: ${existingMap.size} (will update)`);
  console.log(`New parts to create: ${rows.length - existingMap.size}`);

  // Import
  let created = 0;
  let updated = 0;
  let imagesProcessed = 0;
  const BATCH = 50;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        const categoryId = row.category ? categoryMap.get(row.category) : undefined;
        const barcodeValue = generatePartBarcodeValue(row.partNumber);
        const existingId = existingMap.get(row.partNumber);

        if (existingId) {
          await tx.part.update({
            where: { id: existingId },
            data: {
              partName: row.partName,
              categoryId,
              location: row.location,
              unit: row.unit,
              plant: row.plant,
              barcodeValue,
            },
          });
          updated++;
        } else {
          const part = await tx.part.create({
            data: {
              partNumber: row.partNumber,
              partName: row.partName,
              categoryId,
              location: row.location,
              quantity: row.quantity,
              minimumQuantity: 0,
              unit: row.unit,
              plant: row.plant,
              barcodeValue,
            },
          });
          existingMap.set(row.partNumber, part.id);

          if (row.quantity > 0) {
            await tx.stockMovement.create({
              data: {
                partId: part.id,
                userId: admin.id,
                type: "STOCK_IN",
                quantityBefore: 0,
                quantityAfter: row.quantity,
                quantityChange: row.quantity,
                note: "นำเข้าจาก Excel (NBC2)",
              },
            });
          }
          created++;
        }
      }
    }, { timeout: 60_000 });

    process.stdout.write(`\r  DB: ${Math.min(i + BATCH, rows.length)}/${rows.length} rows`);
  }
  console.log(`\n  Created: ${created}, Updated: ${updated}`);

  // Process images
  console.log(`\nProcessing images...`);
  for (const row of rows) {
    const imgBuffer = imageMap.get(row.rowNum);
    if (!imgBuffer) continue;

    const partId = existingMap.get(row.partNumber);
    if (!partId) continue;

    const imageUrl = await processImage(imgBuffer, row.partNumber);
    if (imageUrl) {
      await prisma.part.update({ where: { id: partId }, data: { imageUrl } });
      imagesProcessed++;
      process.stdout.write(`\r  Images: ${imagesProcessed}`);
    }
  }
  console.log(`\n  Images saved: ${imagesProcessed}`);

  // Generate QR codes
  console.log(`\nGenerating QR codes...`);
  let qrCount = 0;
  for (const row of rows) {
    const partId = existingMap.get(row.partNumber);
    if (!partId) continue;
    const qrCodeUrl = await generateQRCode(partId, row.partNumber);
    await prisma.part.update({ where: { id: partId }, data: { qrCodeUrl } });
    qrCount++;
    process.stdout.write(`\r  QR: ${qrCount}/${rows.length}`);
  }
  console.log(`\n  QR codes: ${qrCount}`);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Images: ${imagesProcessed}`);
  console.log(`  QR codes: ${qrCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
