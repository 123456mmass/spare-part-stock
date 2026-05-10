import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest } from "@/lib/auth";
import { createStockMovement, StockError } from "@/lib/stock";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const GET = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await requireAuthFromRequest(request);

    const { id } = await params;

    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        category: true,
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

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.partNumber !== undefined) {
      const dup = await prisma.part.findUnique({ where: { partNumber: body.partNumber } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
      }
      updateData.partNumber = body.partNumber;
    }

    if (body.barcodeValue !== undefined && body.barcodeValue !== null && body.barcodeValue !== "") {
      const barcodeDup = await prisma.part.findUnique({ where: { barcodeValue: body.barcodeValue } });
      if (barcodeDup && barcodeDup.id !== id) {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
      updateData.barcodeValue = body.barcodeValue;
    } else if (body.barcodeValue === null || body.barcodeValue === "") {
      updateData.barcodeValue = null;
    }

    if (body.partName !== undefined) updateData.partName = body.partName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.minimumQuantity !== undefined) updateData.minimumQuantity = body.minimumQuantity;
    if (body.unit !== undefined) updateData.unit = body.unit;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    }

    const part = await prisma.part.update({
      where: { id },
      data: updateData,
      include: { category: true },
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

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    const movementCount = await prisma.stockMovement.count({ where: { partId: id } });
    if (movementCount > 0) {
      return NextResponse.json(
        { error: "ไม่สามารถลบอะไหล่ที่มีประวัติการเคลื่อนไหว" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (existing.quantity > 0) {
        await createStockMovement({
          partId: id,
          userId: user.id,
          type: "ADJUSTMENT",
          quantity: 0,
          note: "ลบอะไหล่",
        });
      }
      await tx.part.update({
        where: { id },
        data: { isActive: false },
      });
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
