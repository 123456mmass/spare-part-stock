import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { detectImageFormat, normalizeImage } from "@/lib/image-normalize";

const UPLOADS_DIR = path.join(process.cwd(), "public");

type ExcelImageExtension = "jpeg" | "png" | "gif";

async function prepareExcelImage(buffer: Buffer): Promise<{ buffer: Buffer; extension: ExcelImageExtension }> {
  const format = detectImageFormat(buffer);

  if (format === "JPEG") return { buffer, extension: "jpeg" };
  if (format === "PNG") return { buffer, extension: "png" };
  if (format === "GIF") return { buffer, extension: "gif" };

  const normalized = await normalizeImage(buffer, { format: "png", maxDimension: 800 });
  return { buffer: normalized.buffer, extension: "png" };
}

export type PartsExportFormat = "standard" | "plant";

export async function generatePartsExportWorkbook(options: {
  format?: string | null;
  plant?: string | null;
}): Promise<{ buffer: ExcelJS.Buffer; filename: string }> {
  const format: PartsExportFormat = options.format === "plant" ? "plant" : "standard";
  const plantFilter = options.plant?.trim() || "";

  const where: Record<string, unknown> = { isActive: true };
  if (plantFilter === "special") {
    where.isSpecialToolPart = true;
  } else if (plantFilter) {
    where.plant = plantFilter;
    where.isSpecialToolPart = false;
  }

  const parts = await prisma.part.findMany({
    where,
    include: { category: true, building: true },
    orderBy: { partNumber: "asc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Parts");

  if (format === "plant") {
    sheet.columns = [
      { header: "No.", key: "no", width: 6 },
      { header: "Plant", key: "plant", width: 10 },
      { header: "System", key: "system", width: 20 },
      { header: "Type", key: "type", width: 20 },
      { header: "Material Description", key: "description", width: 50 },
      { header: "อาคารที่เก็บ", key: "building", width: 18 },
      { header: "Location", key: "location", width: 15 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Stock On Hand", key: "stock", width: 14 },
      { header: "Picture", key: "picture", width: 25 },
    ];

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const row = sheet.addRow({
        no: i + 1,
        plant: p.isSpecialToolPart ? "Special Tool Part" : (p.plant || ""),
        system: p.category?.name || "",
        type: p.subcategory || "",
        description: [p.partNumber, p.partName, p.description].filter(Boolean).join(" - "),
        building: p.building?.name || "",
        location: p.location || "",
        unit: p.unit,
        stock: p.quantity,
        picture: "",
      });
      row.height = 100;
      row.getCell("description").alignment = { wrapText: true, vertical: "top" };

      if (p.imageUrl) {
        await addImageIfPresent(workbook, sheet, p.imageUrl, 9, i + 1, 130, 95);
      }
    }
  } else {
    sheet.columns = [
      { header: "Part Number", key: "partNumber", width: 18 },
      { header: "Part Name", key: "partName", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Category", key: "category", width: 18 },
      { header: "Subcategory", key: "subcategory", width: 15 },
      { header: "อาคารที่เก็บ", key: "building", width: 18 },
      { header: "Block", key: "block", width: 18 },
      { header: "Location", key: "location", width: 15 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Min Qty", key: "minimumQuantity", width: 10 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Barcode", key: "barcodeValue", width: 20 },
      { header: "Picture", key: "picture", width: 20 },
    ];

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      sheet.addRow({
        partNumber: p.partNumber,
        partName: p.partName,
        description: p.description || "",
        category: p.category?.name || "",
        subcategory: p.subcategory || "",
        building: p.building?.name || "",
        block: p.isSpecialToolPart ? "Special Tool Part" : (p.plant || ""),
        location: p.location || "",
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        barcodeValue: p.barcodeValue || "",
        picture: "",
      }).height = 80;

      if (p.imageUrl) {
        await addImageIfPresent(workbook, sheet, p.imageUrl, 12, i + 1, 100, 75);
      }
    }
  }

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = format === "plant" ? "spare-parts-plant.xlsx" : "spare-parts.xlsx";
  return { buffer, filename };
}

async function addImageIfPresent(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  imageUrl: string,
  col: number,
  row: number,
  width: number,
  height: number
) {
  const imgPath = path.join(UPLOADS_DIR, imageUrl);
  try {
    await fs.access(imgPath);
    const imgBuffer = await fs.readFile(imgPath);
    const image = await prepareExcelImage(imgBuffer);
    const imageId = workbook.addImage({
      base64: image.buffer.toString("base64"),
      extension: image.extension,
    });
    sheet.addImage(imageId, {
      tl: { col, row },
      ext: { width, height },
    });
  } catch {
    // Missing images should not block export.
  }
}


