import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, getP2002Fields } from "@/lib/prisma";
import { partUpdateSchema } from "@/lib/validators";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const GET = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await requireAuthFromRequest(request);

    const { id } = await params;

    const part = await prisma.part.findFirst({
      where: { id, isActive: true },
      include: {
        category: true,
        building: true,
        movements: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        },
      },
    });

    if (!part) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    return NextResponse.json(part);
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
    console.error("Mobile part by ID error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
});

export const PUT = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = await requireAuthFromRequest(request);

    const { id } = await params;

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }
    if (user.role !== "ADMIN" && existing.createdBy !== user.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์แก้ไขอะไหล่นี้ (ไม่ใช่ผู้สร้าง)" }, { status: 403 });
    }

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

    // Resolve categoryName to categoryId if provided
    let resolvedCategoryId = data.categoryId ?? undefined;
    const shouldUpdateCategory = data.categoryId !== undefined || data.categoryName !== undefined;
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
        ...(data.buildingId !== undefined && { buildingId: data.buildingId || null }),
        ...(shouldUpdateCategory && { categoryId: resolvedCategoryId ?? null }),
      },
      include: { category: true, building: true },
    });

    return NextResponse.json(part);
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
      }
      if (error.code === "P2002") {
        const fields = getP2002Fields(error);
        if (fields.includes("barcodeValue")) {
          return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
        }
        return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
      }
    }
    console.error("Mobile update part error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการแก้ไขอะไหล่" },
      { status: 500 }
    );
  }
});

export const DELETE = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = await requireAuthFromRequest(request);

    const { id } = await params;

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && existing.createdBy !== user.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ลบอะไหล่นี้ (ไม่ใช่ผู้สร้าง)" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.part.update({ where: { id }, data: { isActive: false } });
    });

    return NextResponse.json({ success: true });
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
    console.error("Mobile delete part error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบอะไหล่" },
      { status: 500 }
    );
  }
});
