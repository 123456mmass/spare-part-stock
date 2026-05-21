import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { partUpdateSchema } from "@/lib/validators";
import { requireAuth, requireRole } from "@/lib/auth";
import { createStockMovement } from "@/lib/stock";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const part = await prisma.part.findFirst({
      where: { id, isActive: true },
      include: {
        category: true,
        movements: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!part) {
      return NextResponse.json(
        { error: "ไม่พบอะไหล่นี้" },
        { status: 404 }
      );
    }

    return NextResponse.json(part);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching part:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, "quantity")) {
      return NextResponse.json(
        { error: "ห้ามแก้ไขจำนวนคงเหลือโดยตรง กรุณาใช้รายการเคลื่อนไหวสต็อก" },
        { status: 400 }
      );
    }
    const parsed = partUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    let resolvedCategoryId = data.categoryId ?? undefined;
    if (!resolvedCategoryId && data.categoryName) {
      const cat = await prisma.category.upsert({
        where: { name: data.categoryName },
        create: { name: data.categoryName },
        update: {},
      });
      resolvedCategoryId = cat.id;
    }

    const part = await prisma.part.update({
      where: { id },
      data: {
        ...(data.partNumber !== undefined && { partNumber: data.partNumber }),
        ...(data.partName !== undefined && { partName: data.partName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.minimumQuantity !== undefined && { minimumQuantity: data.minimumQuantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.barcodeValue !== undefined && { barcodeValue: data.barcodeValue || null }),
        ...(data.subcategory !== undefined && { subcategory: data.subcategory }),
        ...(data.plant !== undefined && { plant: data.plant }),
        categoryId: resolvedCategoryId ?? null,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(part);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.[0] ?? "";
      if (target === "barcodeValue") {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
    }
    console.error("Error updating part:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปเดต" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { id } });
      if (!part) {
        throw new Error("PART_NOT_FOUND");
      }

      // STAFF can only delete parts they created
      if (user.role !== "ADMIN" && part.createdBy !== user.id) {
        throw new Error("FORBIDDEN");
      }

      await tx.part.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PART_NOT_FOUND") {
        return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "ไม่มีสิทธิ์ลบอะไหล่นี้ (ไม่ใช่ผู้สร้าง)" }, { status: 403 });
      }
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    console.error("Error deleting part:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบ" },
      { status: 500 }
    );
  }
}
