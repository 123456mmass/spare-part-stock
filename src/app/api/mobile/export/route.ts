import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";
import { Prisma } from "@prisma/client";
import { detectImageFormat, normalizeImage } from "@/lib/image-normalize";

const UPLOADS_DIR = path.join(process.cwd(), "public");

type ExcelImageExtension = "jpeg" | "png" | "gif";

async function prepareExcelImage(buffer: Buffer): Promise<{ buffer: Buffer; extension: ExcelImageExtension }> {
  const format = detectImageFormat(buffer);

  if (format === "JPEG") return { buffer, extension: "jpeg" };
  if (format === "PNG") return { buffer, extension: "png" };
  if (format === "GIF") return { buffer, extension: "gif" };

  // ExcelJS only supports jpeg/png/gif. Uploaded inventory images are commonly WebP,
  // so convert unsupported-but-decodable formats to PNG before embedding.
  const normalized = await normalizeImage(buffer, { format: "png", maxDimension: 800 });
  return { buffer: normalized.buffer, extension: "png" };
}

export const OPTIONS = corsOptions();

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "standard";
    const plantFilter = searchParams.get("plant")?.trim() || "";
    const where: Prisma.PartWhereInput = { isActive: true };
    if (plantFilter === "special") {
      where.isSpecialToolPart = true;
    } else if (plantFilter === "__none__") {
      where.plant = null;
    } else if (plantFilter) {
      where.plant = plantFilter;
      where.isSpecialToolPart = false;
    }

    const parts = await prisma.part.findMany({
      where,
      include: { category: true },
      orderBy: { partNumber: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Parts");

    if (format === "plant") {
      sheet.columns = [
        { header: "No.", key: "no", width: 6 },
        { header: "Plant", key: "plant", width: 12 },
        { header: "System", key: "system", width: 15 },
        { header: "Type", key: "type", width: 15 },
        { header: "Material Description", key: "description", width: 40 },
        { header: "Location", key: "location", width: 15 },
        { header: "Unit", key: "unit", width: 8 },
        { header: "Stock On Hand", key: "stock", width: 14 },
        { header: "Picture", key: "picture", width: 20 },
      ];

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const row = sheet.addRow({
          no: i + 1,
          plant: p.plant || "",
          system: p.category?.name || "",
          type: p.subcategory || "",
          description: [p.partNumber, p.partName, p.description].filter(Boolean).join(" - "),
          location: p.location || "",
          unit: p.unit,
          stock: p.quantity,
          picture: "",
        });
        row.height = 80;

        if (p.imageUrl) {
          const imgPath = path.join(UPLOADS_DIR, p.imageUrl);
          try {
            await fs.access(imgPath);
            const imgBuffer = await fs.readFile(imgPath);
            const image = await prepareExcelImage(imgBuffer);
            const imageId = workbook.addImage({ base64: image.buffer.toString("base64"), extension: image.extension });
            sheet.addImage(imageId, { tl: { col: 8, row: i + 1 }, ext: { width: 100, height: 75 } });
          } catch { /* skip */ }
        }
      }
    } else {
      sheet.columns = [
        { header: "Part Number", key: "partNumber", width: 18 },
        { header: "Part Name", key: "partName", width: 30 },
        { header: "Description", key: "description", width: 40 },
        { header: "Category", key: "category", width: 18 },
        { header: "Subcategory", key: "subcategory", width: 15 },
        { header: "Block", key: "block", width: 12 },
        { header: "Location", key: "location", width: 15 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Min Qty", key: "minimumQuantity", width: 10 },
        { header: "Unit", key: "unit", width: 8 },
        { header: "Barcode", key: "barcodeValue", width: 20 },
        { header: "Picture", key: "picture", width: 20 },
      ];

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const row = sheet.addRow({
          partNumber: p.partNumber,
          partName: p.partName,
          description: p.description || "",
          category: p.category?.name || "",
          subcategory: p.subcategory || "",
          block: p.plant || "",
          location: p.location || "",
          quantity: p.quantity,
          minimumQuantity: p.minimumQuantity,
          unit: p.unit,
          barcodeValue: p.barcodeValue || "",
          picture: "",
        });
        row.height = 80;

        if (p.imageUrl) {
          const imgPath = path.join(UPLOADS_DIR, p.imageUrl);
          try {
            await fs.access(imgPath);
            const imgBuffer = await fs.readFile(imgPath);
            const image = await prepareExcelImage(imgBuffer);
            const imageId = workbook.addImage({ base64: image.buffer.toString("base64"), extension: image.extension });
            sheet.addImage(imageId, { tl: { col: 11, row: i + 1 }, ext: { width: 100, height: 75 } });
          } catch { /* skip */ }
        }
      }
    }

    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = format === "plant" ? "spare-parts-plant.xlsx" : "spare-parts.xlsx";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 },
      );
    }
    console.error("Mobile export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
});


