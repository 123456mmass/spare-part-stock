import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { partSchema } from "@/lib/validators";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { exportPartsToExcel } from "@/lib/excel";
import { generatePartBarcodeValue, generatePartNumber } from "@/lib/barcode";
import { createStockMovement } from "@/lib/stock";

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

    const where: Prisma.PartWhereInput = { isActive: true };

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
      where.AND = [{ quantity: { lte: prisma.part.fields.minimumQuantity } }];
    } else if (stockStatus === "in-stock") {
      where.AND = [
        {
          OR: [
            { quantity: { gt: prisma.part.fields.minimumQuantity } },
            { minimumQuantity: 0, quantity: { gt: 0 } },
          ],
        },
      ];
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

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      parts,
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

    const body = await request.json();
    const parsed = partSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { partName, description, categoryId, categoryName, subcategory, plant, location, quantity, minimumQuantity, unit, barcodeValue } = parsed.data;
    let { partNumber } = parsed.data;
    if (!partNumber || partNumber === "-") {
      partNumber = generatePartNumber();
    }
    const finalBarcodeValue = barcodeValue || generatePartBarcodeValue(partNumber);

    const part = await prisma.$transaction(async (tx) => {
      let resolvedCategoryId = categoryId || null;
      if (!resolvedCategoryId && categoryName) {
        const cat = await tx.category.upsert({
          where: { name: categoryName },
          create: { name: categoryName },
          update: {},
        });
        resolvedCategoryId = cat.id;
      }

      const created = await tx.part.create({
        data: {
          partNumber,
          partName,
          description,
          categoryId: resolvedCategoryId,
          subcategory: subcategory || null,
          plant: plant || null,
          createdBy: user.id,
          location,
          quantity: 0,
          minimumQuantity: minimumQuantity ?? 0,
          unit: unit || "pcs",
          barcodeValue: finalBarcodeValue,
        },
        include: { category: true },
      });

      if ((quantity ?? 0) > 0) {
        await createStockMovement(
          {
            partId: created.id,
            userId: user.id,
            type: "STOCK_IN",
            quantity: quantity ?? 0,
            note: "สร้างอะไหล่ใหม่",
          },
          tx
        );
      }

      return tx.part.findUnique({
        where: { id: created.id },
        include: { category: true },
      });
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } | undefined;
      const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
      const targetStr = Array.isArray(adapterFields)
        ? adapterFields.join(",")
        : Array.isArray(meta?.target)
          ? meta.target.join(",")
          : String(meta?.target ?? error.message ?? "");
      if (targetStr.includes("barcodeValue")) {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
    }
    console.error("Mobile create part error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างอะไหล่" },
      { status: 500 }
    );
  }
});
