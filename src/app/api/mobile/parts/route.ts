import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { partSchema } from "@/lib/validators";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { exportPartsToExcel } from "@/lib/excel";
import { generatePartBarcodeValue } from "@/lib/barcode";

export const OPTIONS = corsOptions();

const querySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  stockStatus: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const { searchParams } = new URL(request.url);
    const exportFlag = searchParams.get("export");

    if (exportFlag === "true") {
      const buffer = await exportPartsToExcel();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=parts.xlsx",
        },
      });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { search, categoryId, stockStatus, page, limit } = parsed.data;

    const where: Record<string, unknown> = { isActive: true };

    if (search) {
      where.OR = [
        { partNumber: { contains: search } },
        { partName: { contains: search } },
        { location: { contains: search } },
        { barcodeValue: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (stockStatus === "out-of-stock") {
      where.quantity = 0;
    } else if (stockStatus === "low-stock") {
      where.quantity = { gt: 0 };
      where.minimumQuantity = { gt: 0 };
    } else if (stockStatus === "in-stock") {
      where.quantity = { gt: 0 };
    }

    const [total, parts] = await Promise.all([
      prisma.part.count({ where }),
      prisma.part.findMany({
        where,
        include: { category: true },
        orderBy: { partNumber: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Filter low-stock server-side (field-to-field comparison not supported in Prisma where)
    let filteredParts = parts;
    if (stockStatus === "low-stock") {
      filteredParts = parts.filter(p => p.quantity <= p.minimumQuantity);
    } else if (stockStatus === "in-stock") {
      filteredParts = parts.filter(p => p.quantity > p.minimumQuantity || p.minimumQuantity === 0);
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      parts: filteredParts,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 }
      );
    }
    console.error("Mobile parts error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
});

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = partSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { partNumber, partName, description, categoryId, location, quantity, minimumQuantity, unit, barcodeValue } = parsed.data;
    const finalBarcodeValue = barcodeValue || generatePartBarcodeValue(partNumber);

    const existing = await prisma.part.findUnique({
      where: { partNumber },
    });

    if (existing) {
      return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
    }

    if (finalBarcodeValue) {
      const barcodeDup = await prisma.part.findUnique({
        where: { barcodeValue: finalBarcodeValue },
      });
      if (barcodeDup) {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
    }

    const part = await prisma.$transaction(async (tx) => {
      const created = await tx.part.create({
        data: {
          partNumber,
          partName,
          description,
          categoryId: categoryId || null,
          location,
          quantity: quantity ?? 0,
          minimumQuantity: minimumQuantity ?? 0,
          unit: unit || "pcs",
          barcodeValue: finalBarcodeValue,
        },
        include: { category: true },
      });

      if ((quantity ?? 0) > 0) {
        await tx.stockMovement.create({
          data: {
            partId: created.id,
            userId: user.id,
            type: "STOCK_IN",
            quantityBefore: 0,
            quantityAfter: quantity ?? 0,
            quantityChange: quantity ?? 0,
            note: "สร้างอะไหล่ใหม่",
          },
        });
      }

      return created;
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 }
      );
    }
    console.error("Mobile create part error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างอะไหล่" },
      { status: 500 }
    );
  }
});
