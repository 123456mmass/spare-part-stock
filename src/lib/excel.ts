import ExcelJS from "exceljs";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { prisma } from "./prisma";
import { generateQRCode } from "./qrcode";
import { generatePartBarcodeValue } from "./barcode";
import {
  validateImportRows,
  type RawImportRow,
  type ValidatedImportRow,
} from "./import-validation";
import { createStockMovement } from "./stock";
import { resolveBuildingIdByName } from "./buildings";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const MAX_ROWS = 200000;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 500 * 1024 * 1024;
const BATCH_SIZE = 500;

export interface ExcelPartRow {
  partNumber: string;
  partName: string;
  description?: string;
  category?: string;
  location?: string;
  quantity: number;
  minimumQuantity?: number;
  unit?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  imagesExtracted: number;
}

interface ImportPreflightResult {
  existingPartsByPartNumber: Map<
    string,
    {
      id: string;
      partNumber: string;
      barcodeValue: string | null;
    }
  >;
}

export async function ensureImagesDir() {
  try {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

interface ExtractedImage {
  buffer: Buffer;
  rowIndex: number;
}

export async function extractImagesFromWorkbook(
  workbook: ExcelJS.Workbook
): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = [];
  let totalImageBytes = 0;

  for (const sheet of workbook.worksheets) {
    // Get all images from the worksheet
    const sheetImages = sheet.getImages();

    for (let imgIdx = 0; imgIdx < sheetImages.length; imgIdx++) {
      const img = sheetImages[imgIdx];
      const { imageId, range } = img;

      // Get the image from the workbook media - imageId is the index
      const image = workbook.model.media[Number(imageId)];
      if (!image) continue;

      // Extract buffer
      const buffer = Buffer.from(image.buffer as ArrayBuffer);
      if (!buffer || buffer.length === 0) continue;
      if (buffer.length > MAX_IMAGE_SIZE) continue;
      totalImageBytes += buffer.length;
      if (totalImageBytes > MAX_TOTAL_IMAGE_SIZE) break;

      // Calculate row index from the image range
      // ImageRange has 'tl' (top-left) with row/col properties
      // Note: row can be fractional (e.g. 2.028) because image top may be mid-row, so use Math.round
      const imageRange = range as { tl?: { row?: number } };
      const rowIndex = Math.round(imageRange.tl?.row ?? 1) + 1; // imageRange is 0-indexed, but our row parsing starts at row 2 for data
      images.push({ buffer, rowIndex });
    }
  }

  return images;
}

export async function processAndSaveImage(
  buffer: Buffer,
  partNumber: string
): Promise<string | null> {
  await ensureImagesDir();

  const sanitizedPartNumber = partNumber.replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `${sanitizedPartNumber}.webp`;
  const filePath = path.join(IMAGES_DIR, fileName);
  const publicPath = `/uploads/images/${fileName}`;

  try {
    // Process image with sharp - resize and convert to webp
    await sharp(buffer)
      .resize(800, 800, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(filePath);

    return publicPath;
  } catch (error) {
    console.error(`Failed to process image for ${partNumber}:`, error);
    return null;
  }
}

export async function preflightImportRows(
  rows: ValidatedImportRow[],
  errors: string[]
): Promise<ImportPreflightResult | null> {
  const partNumbers = rows.map((row) => row.partNumber);
  const barcodes = rows.map((row) => row.finalBarcodeValue);

  // SQLite has variable limits; batch the lookup in chunks of 500
  const PREFLIGHT_BATCH = 500;
  const existingParts: { id: string; partNumber: string; barcodeValue: string | null }[] = [];

  for (let i = 0; i < partNumbers.length; i += PREFLIGHT_BATCH) {
    const pnBatch = partNumbers.slice(i, i + PREFLIGHT_BATCH);
    const bcBatch = barcodes.slice(i, i + PREFLIGHT_BATCH);
    const batch = await prisma.part.findMany({
      where: {
        OR: [
          { partNumber: { in: pnBatch } },
          { barcodeValue: { in: bcBatch } },
        ],
      },
      select: { id: true, partNumber: true, barcodeValue: true },
    });
    existingParts.push(...batch);
  }

  // Deduplicate (a part may appear in multiple batches if barcode overlaps)
  const deduped = [...new Map(existingParts.map((p) => [p.id, p])).values()];

  const existingPartsByPartNumber = new Map(
    deduped.map((part) => [part.partNumber, part])
  );
  const existingPartsByBarcode = new Map(
    deduped
      .filter((part) => part.barcodeValue)
      .map((part) => [part.barcodeValue as string, part])
  );

  for (const row of rows) {
    const barcodeOwner = existingPartsByBarcode.get(row.finalBarcodeValue);
    if (barcodeOwner && barcodeOwner.partNumber !== row.partNumber) {
      errors.push(
        `แถว ${row.rowNum}: บาร์โค้ด ${row.finalBarcodeValue} ถูกใช้งานโดย ${barcodeOwner.partNumber}`
      );
    }
  }

  const buildingNameCache = new Map<string, string | null>();
  for (const row of rows) {
    const location = row.location?.trim();
    if (!location) {
      errors.push(`แถว ${row.rowNum}: ต้องระบุ Location (อาคารที่จัดเก็บ)`);
      continue;
    }
    const cacheKey = location.toLowerCase();
    if (!buildingNameCache.has(cacheKey)) {
      buildingNameCache.set(cacheKey, await resolveBuildingIdByName(location));
    }
    if (!buildingNameCache.get(cacheKey)) {
      errors.push(
        `แถว ${row.rowNum}: ไม่พบอาคาร "${location}" — สร้างอาคารในเมนูอาคารก่อนนำเข้า`
      );
    }
  }

  if (errors.length > 0) {
    return null;
  }

  return {
    existingPartsByPartNumber,
  };
}

export async function applyImportedRows(params: {
  rows: ValidatedImportRow[];
  userId: string;
  overridePlant?: string;
  existingPartsByPartNumber: Map<
    string,
    {
      id: string;
      partNumber: string;
      barcodeValue: string | null;
    }
  >;
}): Promise<{
  imported: number;
  updated: number;
  imageUpdates: { partId: string; partNumber: string; rowNum: number }[];
  qrUpdates: { partId: string; partNumber: string }[];
}> {
  const { rows, userId, overridePlant, existingPartsByPartNumber } = params;
  const imageUpdates: { partId: string; partNumber: string; rowNum: number }[] = [];
  const qrUpdates: { partId: string; partNumber: string }[] = [];
  let imported = 0;
  let updated = 0;

  // Pre-resolve all categories in one pass
  const categoryNames = [...new Set(rows.map((r) => r.categoryName).filter(Boolean))] as string[];
  const categoryMap = new Map<string, string>();
  if (categoryNames.length > 0) {
    for (const name of categoryNames) {
      const cat = await prisma.category.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      categoryMap.set(name, cat.id);
    }
  }

  // Pre-resolve building names from location column (Excel Location = อาคาร)
  const buildingNameSet = [
    ...new Set(rows.map((r) => r.location?.trim()).filter(Boolean)),
  ] as string[];
  const buildingIdMap = new Map<string, string | null>();
  for (const name of buildingNameSet) {
    buildingIdMap.set(name.toLowerCase(), await resolveBuildingIdByName(name));
  }

  // Separate rows into new vs existing
  const newRows: ValidatedImportRow[] = [];
  const updateRows: (ValidatedImportRow & { existingId: string })[] = [];
  for (const row of rows) {
    const existing = existingPartsByPartNumber.get(row.partNumber);
    if (existing) {
      updateRows.push({ ...row, existingId: existing.id });
    } else {
      newRows.push(row);
    }
  }

  // Batch create new parts
  for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
    const batch = newRows.slice(i, i + BATCH_SIZE);
    await prisma.part.createMany({
      data: batch.map((row) => ({
        partNumber: row.partNumber,
        partName: row.partName,
        description: row.description,
        categoryId: row.categoryName ? categoryMap.get(row.categoryName) : undefined,
        subcategory: row.subcategory || null,
        plant: overridePlant || row.plant || null,
        buildingId: row.location
          ? buildingIdMap.get(row.location.trim().toLowerCase()) ?? null
          : null,
        location: row.location,
        quantity: row.quantity,
        minimumQuantity: row.minimumQuantity,
        unit: row.unit,
        barcodeValue: row.finalBarcodeValue,
      })),
    });
    imported += batch.length;
  }

  // Fetch created parts to get IDs for image/QR updates (batched for SQLite variable limit)
  if (newRows.length > 0) {
    const createdParts: { id: string; partNumber: string }[] = [];
    const allNewPartNumbers = newRows.map((r) => r.partNumber);
    for (let i = 0; i < allNewPartNumbers.length; i += BATCH_SIZE) {
      const pnBatch = allNewPartNumbers.slice(i, i + BATCH_SIZE);
      const batch = await prisma.part.findMany({
        where: { partNumber: { in: pnBatch } },
        select: { id: true, partNumber: true },
      });
      createdParts.push(...batch);
    }
    const createdMap = new Map(createdParts.map((p) => [p.partNumber, p.id]));

    // Create stock movements for new parts with quantity > 0
    const movementsToCreate = newRows
      .filter((r) => r.quantity > 0)
      .map((r) => ({
        partId: createdMap.get(r.partNumber)!,
        userId,
        type: "STOCK_IN" as const,
        quantityBefore: 0,
        quantityAfter: r.quantity,
        quantityChange: r.quantity,
        note: "สร้างจาก Excel import",
      }))
      .filter((m) => m.partId);

    for (let i = 0; i < movementsToCreate.length; i += BATCH_SIZE) {
      const batch = movementsToCreate.slice(i, i + BATCH_SIZE);
      await prisma.stockMovement.createMany({ data: batch });
    }

    for (const row of newRows) {
      const partId = createdMap.get(row.partNumber);
      if (partId) {
        qrUpdates.push({ partId, partNumber: row.partNumber });
        imageUpdates.push({ partId, partNumber: row.partNumber, rowNum: row.rowNum });
      }
    }
  }

  // Batch update existing parts (must be individual updates due to different data per row)
  for (let i = 0; i < updateRows.length; i += BATCH_SIZE) {
    const batch = updateRows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          await tx.part.update({
            where: { id: row.existingId },
            data: {
              partName: row.partName,
              description: row.description,
              categoryId: row.categoryName ? categoryMap.get(row.categoryName) : undefined,
              location: row.location,
              buildingId: row.location
                ? buildingIdMap.get(row.location.trim().toLowerCase()) ?? null
                : undefined,
              minimumQuantity: row.minimumQuantity,
              unit: row.unit,
              barcodeValue: row.finalBarcodeValue,
              ...((overridePlant || row.plant) ? { plant: overridePlant || row.plant } : {}),
            },
          });

          if (row.quantity > 0) {
            await createStockMovement(
              {
                partId: row.existingId,
                userId,
                type: "ADJUSTMENT",
                quantity: row.quantity,
                note: "นำเข้าจาก Excel",
              },
              tx
            );
          }
        }
      },
      { timeout: 300_000, maxWait: 30_000 }
    );
    updated += batch.length;

    for (const row of batch) {
      qrUpdates.push({ partId: row.existingId, partNumber: row.partNumber });
      imageUpdates.push({ partId: row.existingId, partNumber: row.partNumber, rowNum: row.rowNum });
    }
  }

  return {
    imported,
    updated,
    imageUpdates,
    qrUpdates,
  };
}

export async function importPartsFromExcel(
  fileBuffer: ArrayBuffer | Buffer,
  userId: string,
  overridePlant?: string
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    updated: 0,
    errors: [],
    imagesExtracted: 0,
  };

  try {
    // Load workbook
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.worksheets.length > 1
      ? workbook.worksheets.reduce((best, ws) => (ws.rowCount > best.rowCount ? ws : best), workbook.worksheets[0])
      : workbook.getWorksheet(1);
    if (!worksheet) {
      result.errors.push("ไม่พบ Sheet ที่ 1 ในไฟล์ Excel");
      return result;
    }

    // Extract images first
    const extractedImages = await extractImagesFromWorkbook(workbook);
    result.imagesExtracted = extractedImages.length;

    // Create a map of row index to image buffer
    const imageMap = new Map<number, Buffer>();
    for (const img of extractedImages) {
      imageMap.set(img.rowIndex, img.buffer);
    }

    // Get header row — try row 1 first, then row 2 (plant export format has blank row 1)
    let headerRowNum = 1;
    const headerRow1 = worksheet.getRow(1);
    let hasContent = false;
    headerRow1.eachCell((cell) => {
      if (cell.text?.toString().trim()) hasContent = true;
    });
    if (!hasContent) headerRowNum = 2;

    const headerRow = worksheet.getRow(headerRowNum);
    const headers: Record<string, number> = {};

    headerRow.eachCell((cell, colNumber) => {
      const headerText = cell.text?.toString().trim().toLowerCase() || "";
      headers[headerText] = colNumber;
    });

    // Resolve column index for a field, checking multiple possible header names
    function getCol(...names: string[]): number | undefined {
      for (const name of names) {
        if (headers[name] !== undefined) return headers[name];
      }
      return undefined;
    }

    // Detect if this is a "plant" export format from our system
    const isPlantFormat = headers["material description"] !== undefined && headers["stock on hand"] !== undefined;

    // Validate required headers
    let partNumberCol: number | undefined;
    let partNameCol: number | undefined;
    let quantityCol: number | undefined;

    if (isPlantFormat) {
      // Plant format: Type=partNumber(optional), Material Description=partName, Stock On Hand=quantity
      partNameCol = getCol("material description");
      quantityCol = getCol("stock on hand");
      partNumberCol = getCol("type"); // may be empty in data — handled below
    } else {
      partNumberCol = getCol("part number", "part no.", "part no", "item code", "sku");
      partNameCol = getCol("part name", "description", "desc", "item name", "name");
      quantityCol = getCol("quantity", "qty", "stock", "count");
    }

    if (!partNameCol) {
      result.errors.push('ไม่พบคอลัมน์ "Part Name" / "Material Description" ที่จำเป็น');
      return result;
    }
    if (!quantityCol) {
      result.errors.push('ไม่พบคอลัมน์ "Quantity" / "Stock On Hand" ที่จำเป็น');
      return result;
    }

    const categoryCol = isPlantFormat
      ? getCol("system")
      : getCol("category", "type", "group", "หมวดหมู่", "ประเภท");
    const locationCol = getCol("location", "storage", "bin");
    const minQtyCol = getCol("minimum quantity", "min qty", "min quantity", "min");
    const unitCol = getCol("unit", "uom", "measure");
    const descriptionCol = isPlantFormat ? undefined : getCol("description", "desc", "detail");
    const barcodeCol = getCol("barcode", "barcodevalue", "บาร์โค้ด");
    const plantCol = isPlantFormat ? getCol("plant") : undefined;
    const noCol = isPlantFormat ? getCol("no.") : undefined;

    // Parse all rows first
    const totalRows = worksheet.actualRowCount || worksheet.rowCount || 1;
    const dataStartRow = headerRowNum + 1;
    const rowCount = Math.min(totalRows, MAX_ROWS + headerRowNum);
    if (totalRows > MAX_ROWS + headerRowNum) {
      result.errors.push(`ไฟล์มีข้อมูลเกิน ${MAX_ROWS} แถว จะนำเข้าเฉพาะ ${MAX_ROWS} แถวแรก`);
    }

    const parsedRows: RawImportRow[] = [];
    let autoNumCounter = 0;

    for (let rowNum = dataStartRow; rowNum <= rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const partName = row.getCell(partNameCol).text?.toString().trim() || "";
      if (!partName) continue; // skip empty rows

      let partNumber = "";
      if (isPlantFormat) {
        // In plant format, "Type" column may be empty — generate from No. or row counter
        partNumber = partNumberCol ? (row.getCell(partNumberCol).text?.toString().trim() || "") : "";
        if (!partNumber) {
          autoNumCounter++;
          const noText = noCol ? (row.getCell(noCol).text?.toString().trim() || "") : "";
          partNumber = noText ? `PLANT-${noText.padStart(4, "0")}` : `PLANT-${String(autoNumCounter).padStart(4, "0")}`;
        }
      } else {
        partNumber = partNumberCol ? (row.getCell(partNumberCol).text?.toString().trim() || "") : "";
        if (!partNumber) {
          result.errors.push(`แถว ${rowNum}: ไม่มี part number`);
          continue;
        }
      }

      const description = descriptionCol ? (row.getCell(descriptionCol)?.text?.toString().trim() || undefined) : undefined;
      const categoryName = categoryCol ? (row.getCell(categoryCol)?.text?.toString().trim() || undefined) : undefined;
      const location = locationCol ? (row.getCell(locationCol)?.text?.toString().trim() || undefined) : undefined;
      const quantityText = row.getCell(quantityCol!).text?.toString().trim() || "0";
      // Handle non-numeric quantities like "1ม้วน" — extract leading digits
      const qtyClean = quantityText.match(/^\d+/) ? (quantityText.match(/^\d+/)![0]) : "0";
      const minQtyText = minQtyCol ? (row.getCell(minQtyCol)?.text?.toString().trim() || "0") : "0";
      const unit = unitCol ? (row.getCell(unitCol)?.text?.toString().trim() || "pcs") : "pcs";
      const barcodeValue = barcodeCol ? (row.getCell(barcodeCol)?.text?.toString().trim() || undefined) : undefined;

      // Capture plant from row for plant format
      const rowPlant = (isPlantFormat && plantCol)
        ? (row.getCell(plantCol).text?.toString().trim() || undefined)
        : undefined;

      parsedRows.push({
        rowNum,
        partNumber,
        partName,
        description,
        categoryName,
        plant: rowPlant,
        location,
        quantity: qtyClean,
        minimumQuantity: minQtyText,
        unit,
        barcodeValue: barcodeValue || undefined,
      });
    }

    const validated = validateImportRows(parsedRows, generatePartBarcodeValue);
    result.errors.push(...validated.errors);

    if (validated.rows.length > 0) {
      const buildingNames = [
        ...new Set(validated.rows.map((r) => r.location?.trim()).filter(Boolean)),
      ] as string[];
      const buildingIdMap = new Map<string, string | null>();
      for (const name of buildingNames) {
        buildingIdMap.set(name.toLowerCase(), await resolveBuildingIdByName(name));
      }
      for (const row of validated.rows) {
        const loc = row.location?.trim();
        if (!loc) {
          result.errors.push(`แถว ${row.rowNum}: ต้องระบุ Location (อาคาร)`);
          continue;
        }
        if (!buildingIdMap.get(loc.toLowerCase())) {
          result.errors.push(
            `แถว ${row.rowNum}: ไม่พบอาคาร "${loc}" — สร้างอาคารก่อนนำเข้า`
          );
        }
      }
    }

    const preflight = await preflightImportRows(validated.rows, result.errors);
    if (result.errors.length > 0 || !preflight) {
      return result;
    }

    const applied = await applyImportedRows({
      rows: validated.rows,
      userId,
      overridePlant,
      existingPartsByPartNumber: preflight.existingPartsByPartNumber,
    });

    result.imported = applied.imported;
    result.updated = applied.updated;

    // Process images in parallel with concurrency limit
    const IMAGE_CONCURRENCY = 10;
    const imageItems = applied.imageUpdates.filter((img) => imageMap.has(img.rowNum));
    for (let i = 0; i < imageItems.length; i += IMAGE_CONCURRENCY) {
      const batch = imageItems.slice(i, i + IMAGE_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (img) => {
          const imageBuffer = imageMap.get(img.rowNum);
          if (!imageBuffer) return null;
          const imageUrl = await processAndSaveImage(imageBuffer, img.partNumber);
          if (imageUrl) return { partId: img.partId, imageUrl };
          return null;
        })
      );
      const updates = results
        .filter((r): r is PromiseFulfilledResult<{ partId: string; imageUrl: string } | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter(Boolean) as { partId: string; imageUrl: string }[];
      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map((u) => prisma.part.update({ where: { id: u.partId }, data: { imageUrl: u.imageUrl } }))
        );
      }
    }
    result.imagesExtracted = imageItems.length;

    // Batch QR generation with concurrency limit
    const QR_CONCURRENCY = 20;
    for (let i = 0; i < applied.qrUpdates.length; i += QR_CONCURRENCY) {
      const batch = applied.qrUpdates.slice(i, i + QR_CONCURRENCY);
      const qrResults = await Promise.allSettled(
        batch.map(async (qr) => {
          const qrCodeUrl = await generateQRCode(qr.partId, qr.partNumber);
          return { partId: qr.partId, qrCodeUrl };
        })
      );
      const qrUpdates = qrResults
        .filter((r): r is PromiseFulfilledResult<{ partId: string; qrCodeUrl: string }> => r.status === "fulfilled")
        .map((r) => r.value);
      if (qrUpdates.length > 0) {
        await prisma.$transaction(
          qrUpdates.map((u) => prisma.part.update({ where: { id: u.partId }, data: { qrCodeUrl: u.qrCodeUrl } }))
        );
      }
    }

    result.success = result.errors.length === 0;

  } catch {
    result.errors.push("การอ่านไฟล์ Excel ล้มเหลว กรุณาตรวจสอบรูปแบบไฟล์");
  }

  return result;
}

export async function exportPartsToExcel(): Promise<Buffer> {
  const parts = await prisma.part.findMany({
    where: { isActive: true },
    include: {
      category: true,
      building: true,
    },
    orderBy: {
      partNumber: "asc",
    },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Spare Parts");

  // Add headers
  worksheet.columns = [
    { header: "Part Number", key: "partNumber", width: 20 },
    { header: "Part Name", key: "partName", width: 30 },
    { header: "Description", key: "description", width: 40 },
    { header: "Category", key: "category", width: 15 },
    { header: "Building", key: "building", width: 15 },
    { header: "Block", key: "block", width: 10 },
    { header: "Location", key: "location", width: 15 },
    { header: "Quantity", key: "quantity", width: 10 },
    { header: "Minimum Quantity", key: "minimumQuantity", width: 15 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Barcode", key: "barcodeValue", width: 20 },
    { header: "Status", key: "status", width: 15 },
  ];

  // Add data rows
  for (const part of parts) {
    let status = "In Stock";
    if (part.quantity === 0) status = "Out of Stock";
    else if (part.quantity <= part.minimumQuantity) status = "Low Stock";

    worksheet.addRow({
      partNumber: part.partNumber,
      partName: part.partName,
      description: part.description || "",
      category: part.category?.name || "",
      building: part.building?.name || "",
      block: part.plant || "",
      location: part.location || "",
      quantity: part.quantity,
      minimumQuantity: part.minimumQuantity,
      unit: part.unit,
      barcodeValue: part.barcodeValue || "",
      status,
    });
  }

  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buffer as any;
}

export async function exportMovementsToExcel(): Promise<Buffer> {
  const movements = await prisma.stockMovement.findMany({
    include: {
      part: true,
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Stock Movements");

  worksheet.columns = [
    { header: "Date", key: "createdAt", width: 20 },
    { header: "Part Number", key: "partNumber", width: 15 },
    { header: "Part Name", key: "partName", width: 25 },
    { header: "Movement Type", key: "type", width: 15 },
    { header: "Quantity Before", key: "quantityBefore", width: 15 },
    { header: "Quantity After", key: "quantityAfter", width: 15 },
    { header: "Change", key: "quantityChange", width: 10 },
    { header: "User", key: "userName", width: 15 },
    { header: "Note", key: "note", width: 30 },
  ];

  for (const movement of movements) {
    worksheet.addRow({
      createdAt: movement.createdAt.toISOString().split("T")[0],
      partNumber: movement.part.partNumber,
      partName: movement.part.partName,
      type: movement.type === "STOCK_IN" ? "Stock In" : movement.type === "STOCK_OUT" ? "Stock Out" : "Adjustment",
      quantityBefore: movement.quantityBefore,
      quantityAfter: movement.quantityAfter,
      quantityChange: movement.quantityChange,
      userName: movement.user.name,
      note: movement.note || "",
    });
  }

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return buffer as any;
}
