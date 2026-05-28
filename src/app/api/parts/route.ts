import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { partSchema } from "@/lib/validators";
import { requireAuth } from "@/lib/auth";
import { generatePartBarcodeValue, generatePartNumber } from "@/lib/barcode";
import { createStockMovement } from "@/lib/stock";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const stockStatus = searchParams.get("stockStatus");
    const plant = searchParams.get("plant");
    const buildingId = searchParams.get("buildingId");

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

    if (plant) {
      where.plant = plant === "__none__" ? null : plant;
    }

    if (buildingId) {
      where.buildingId = buildingId === "__none__" ? null : buildingId;
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
        building: true,
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
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
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

    const { partName, description, categoryId, categoryName, subcategory, plant, buildingId, location, quantity, minimumQuantity, unit, barcodeValue } = parsed.data;
    let { partNumber } = parsed.data;
    if (!partNumber || partNumber === "-") {
      partNumber = generatePartNumber();
    }
    const finalBarcodeValue = barcodeValue || generatePartBarcodeValue(partNumber);

    const part = await prisma.$transaction(async (tx) => {
      // Auto-create category if categoryName provided but no categoryId
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
          buildingId,
          createdBy: user.id,
          location,
          quantity: 0,
          minimumQuantity: minimumQuantity ?? 0,
          unit: unit || "pcs",
          barcodeValue: finalBarcodeValue,
        },
        include: {
          category: true,
        },
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
        include: {
          category: true,
          building: true,
        },
      });
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
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
    console.error("Error creating part:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการสร้างอะไหล่" },
      { status: 500 }
    );
  }
}
