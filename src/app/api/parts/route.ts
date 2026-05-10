import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { partSchema } from "@/lib/validators";
import { requireAuth } from "@/lib/auth";
import { generatePartBarcodeValue } from "@/lib/barcode";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const stockStatus = searchParams.get("stockStatus");

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
      where.minimumQuantity = { gt: 0 };
    } else if (stockStatus === "in-stock") {
      where.quantity = { gt: 0 };
    }

    let parts = await prisma.part.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { partNumber: "asc" },
    });

    // Filter low-stock server-side (field-to-field comparison not supported in Prisma where)
    if (stockStatus === "low-stock") {
      parts = parts.filter(p => p.quantity <= p.minimumQuantity);
    } else if (stockStatus === "in-stock") {
      parts = parts.filter(p => p.quantity > p.minimumQuantity || p.minimumQuantity === 0);
    }

    return NextResponse.json(parts);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching parts:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

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
      return NextResponse.json(
        { error: "รหัสอะไหล่นี้มีอยู่แล้ว" },
        { status: 400 }
      );
    }

    if (finalBarcodeValue) {
      const barcodeDup = await prisma.part.findUnique({
        where: { barcodeValue: finalBarcodeValue },
      });
      if (barcodeDup) {
        return NextResponse.json(
          { error: "บาร์โค้ดนี้มีอยู่แล้ว" },
          { status: 400 }
        );
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
        include: {
          category: true,
        },
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
    console.error("Error creating part:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างอะไหล่" },
      { status: 500 }
    );
  }
}
