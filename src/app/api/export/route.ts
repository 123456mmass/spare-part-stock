import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "public");

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "standard";
    const plantFilter = searchParams.get("plant") || "";

    const where: Record<string, unknown> = { isActive: true };
    if (plantFilter) where.plant = plantFilter;

    const parts = await prisma.part.findMany({
      where,
      include: { category: true },
      orderBy: { partNumber: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Parts");

    if (format === "plant") {
      // Format 2: No. Plant System Type Material Description Location Unit Stock On Hand Picture
      sheet.columns = [
        { header: "No.", key: "no", width: 6 },
        { header: "Plant", key: "plant", width: 10 },
        { header: "System", key: "system", width: 20 },
        { header: "Type", key: "type", width: 20 },
        { header: "Material Description", key: "description", width: 50 },
        { header: "Location", key: "location", width: 15 },
        { header: "Unit", key: "unit", width: 8 },
        { header: "Stock On Hand", key: "stock", width: 14 },
        { header: "Picture", key: "picture", width: 25 },
      ];

      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const row = sheet.addRow({
          no: i + 1,
          plant: p.plant || "",
          system: p.category?.name || "",
          type: p.subcategory || "",
          description: `${p.partNumber}${p.partName ? " " + p.partName : ""}${p.description ? " " + p.description : ""}`,
          location: p.location || "",
          unit: p.unit,
          stock: p.quantity,
          picture: "",
        });
        row.height = 100;
        row.getCell("description").alignment = { wrapText: true, vertical: "top" };

        // Embed image if exists
        if (p.imageUrl) {
          const imgPath = path.join(UPLOADS_DIR, p.imageUrl);
          try {
            await fs.access(imgPath);
            const imgBuffer = await fs.readFile(imgPath);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const imageId = workbook.addImage({ buffer: imgBuffer as any, extension: "jpeg" });
            sheet.addImage(imageId, {
              tl: { col: 8, row: i + 1 },
              ext: { width: 130, height: 95 },
            });
          } catch {
            // Image file not found, skip
          }
        }
      }
    } else {
      // Format 1: Standard
      sheet.columns = [
        { header: "Part Number", key: "partNumber", width: 18 },
        { header: "Part Name", key: "partName", width: 30 },
        { header: "Description", key: "description", width: 40 },
        { header: "Category", key: "category", width: 18 },
        { header: "Subcategory", key: "subcategory", width: 15 },
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
            const ext = path.extname(imgPath).toLowerCase();
            const imgType = ext === ".png" ? "png" : ext === ".gif" ? "gif" : "jpeg";
            const imageId = workbook.addImage({ buffer: imgBuffer as any, extension: imgType as "png" | "jpeg" | "gif" });
            sheet.addImage(imageId, {
              tl: { col: 10, row: i + 1 },
              ext: { width: 100, height: 75 },
            });
          } catch {
            // skip
          }
        }
      }
    }

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

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
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
