import ExcelJS from "exceljs";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { prisma } from "./prisma";
import { generateQRCode } from "./qrcode";
import { generatePartBarcodeValue } from "./barcode";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const IMAGES_DIR = path.join(UPLOADS_DIR, "images");
const MAX_ROWS = 5000;

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

export async function importPartsFromExcel(
  fileBuffer: ArrayBuffer | Buffer,
  userId: string
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

    const worksheet = workbook.getWorksheet(1);
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

    // Get header row (row 1)
    const headerRow = worksheet.getRow(1);
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

    // Validate required headers
    const partNumberCol = getCol("part number", "part no.", "part no", "item code", "sku");
    const partNameCol = getCol("part name", "description", "desc", "item name", "name");
    const quantityCol = getCol("quantity", "qty", "stock", "count");

    if (!partNumberCol) {
      result.errors.push('ไม่พบคอลัมน์ "Part Number" หรือ "Part No." ที่จำเป็น');
      return result;
    }
    if (!partNameCol) {
      result.errors.push('ไม่พบคอลัมน์ "Part Name" หรือ "Description" ที่จำเป็น');
      return result;
    }
    if (!quantityCol) {
      result.errors.push('ไม่พบคอลัมน์ "Quantity" ที่จำเป็น');
      return result;
    }

    const categoryCol = getCol("category", "type", "group", "หมวดหมู่", "ประเภท");
    const locationCol = getCol("location", "storage", "bin");
    const minQtyCol = getCol("minimum quantity", "min qty", "min quantity", "min");
    const unitCol = getCol("unit", "uom", "measure");
    const descriptionCol = getCol("description", "desc", "detail");
    const barcodeCol = getCol("barcode", "barcodevalue", "บาร์โค้ด");

    // Parse all rows first
    const totalRows = worksheet.actualRowCount || worksheet.rowCount || 1;
    const rowCount = Math.min(totalRows, MAX_ROWS + 1);
    if (totalRows > MAX_ROWS + 1) {
      result.errors.push(`ไฟล์มีข้อมูลเกิน ${MAX_ROWS} แถว จะนำเข้าเฉพาะ ${MAX_ROWS} แถวแรก`);
    }

    interface ParsedRow {
      rowNum: number;
      partNumber: string;
      partName: string;
      description?: string;
      categoryName?: string;
      location?: string;
      quantity: number;
      minimumQuantity: number;
      unit: string;
      barcodeValue?: string | null;
    }

    const parsedRows: ParsedRow[] = [];

    for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const partNumber = row.getCell(partNumberCol).text?.toString().trim() || "";
      const partName = row.getCell(partNameCol).text?.toString().trim() || "";

      if (!partNumber || !partName) {
        result.errors.push(`แถว ${rowNum}: ข้อมูล part number หรือ part name ไม่ถูกต้อง`);
        continue;
      }

      const description = descriptionCol ? (row.getCell(descriptionCol)?.text?.toString().trim() || undefined) : undefined;
      const categoryName = categoryCol ? (row.getCell(categoryCol)?.text?.toString().trim() || undefined) : undefined;
      const location = locationCol ? (row.getCell(locationCol)?.text?.toString().trim() || undefined) : undefined;
      const quantityText = row.getCell(quantityCol).text?.toString().trim() || "0";
      const quantity = parseInt(quantityText, 10) || 0;
      const minQtyText = minQtyCol ? (row.getCell(minQtyCol)?.text?.toString().trim() || "0") : "0";
      const minimumQuantity = parseInt(minQtyText, 10) || 0;
      const unit = unitCol ? (row.getCell(unitCol)?.text?.toString().trim() || "pcs") : "pcs";
      const barcodeValue = barcodeCol ? (row.getCell(barcodeCol)?.text?.toString().trim() || undefined) : undefined;

      parsedRows.push({ rowNum, partNumber, partName, description, categoryName, location, quantity, minimumQuantity, unit, barcodeValue: barcodeValue || undefined });
    }

    // Process all rows within a transaction for DB integrity
    const imageUpdates: { partId: string; partNumber: string; rowNum: number }[] = [];
    const qrUpdates: { partId: string; partNumber: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of parsedRows) {
        // Find or create category
        let categoryId: string | undefined;
        if (row.categoryName) {
          const category = await tx.category.upsert({
            where: { name: row.categoryName },
            create: { name: row.categoryName },
            update: {},
          });
          categoryId = category.id;
        }

        const existingPart = await tx.part.findUnique({
          where: { partNumber: row.partNumber },
        });

        let partId: string;

        if (existingPart) {
          const newQuantity = existingPart.quantity + row.quantity;
          await tx.part.update({
            where: { partNumber: row.partNumber },
            data: {
              partName: row.partName,
              description: row.description,
              categoryId,
              location: row.location,
              quantity: newQuantity,
              minimumQuantity: row.minimumQuantity,
              unit: row.unit,
              barcodeValue: row.barcodeValue ?? generatePartBarcodeValue(row.partNumber),
            },
          });

          if (row.quantity > 0) {
            await tx.stockMovement.create({
              data: {
                partId: existingPart.id,
                userId,
                type: "STOCK_IN",
                quantityBefore: existingPart.quantity,
                quantityAfter: newQuantity,
                quantityChange: row.quantity,
                note: "นำเข้าจาก Excel",
              },
            });
          }

          partId = existingPart.id;
          result.updated++;
        } else {
          const created = await tx.part.create({
            data: {
              partNumber: row.partNumber,
              partName: row.partName,
              description: row.description,
              categoryId,
              location: row.location,
              quantity: row.quantity,
              minimumQuantity: row.minimumQuantity,
              unit: row.unit,
              barcodeValue: row.barcodeValue ?? generatePartBarcodeValue(row.partNumber),
            },
          });

          if (row.quantity > 0) {
            await tx.stockMovement.create({
              data: {
                partId: created.id,
                userId,
                type: "STOCK_IN",
                quantityBefore: 0,
                quantityAfter: row.quantity,
                quantityChange: row.quantity,
                note: "สร้างจาก Excel import",
              },
            });
          }

          partId = created.id;
          result.imported++;
        }

        // Queue non-DB operations for after transaction
        qrUpdates.push({ partId, partNumber: row.partNumber });
        if (imageMap.has(row.rowNum)) {
          imageUpdates.push({ partId, partNumber: row.partNumber, rowNum: row.rowNum });
        }
      }
    });

    // Process images and QR codes after transaction commits
    for (const img of imageUpdates) {
      const imageBuffer = imageMap.get(img.rowNum);
      if (imageBuffer) {
        const imageUrl = await processAndSaveImage(imageBuffer, img.partNumber);
        if (imageUrl) {
          await prisma.part.update({
            where: { id: img.partId },
            data: { imageUrl },
          });
        }
      }
    }

    for (const qr of qrUpdates) {
      const qrCodeUrl = await generateQRCode(qr.partId, qr.partNumber);
      await prisma.part.update({
        where: { id: qr.partId },
        data: { qrCodeUrl },
      });
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
