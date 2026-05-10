import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partSchema } from "@/lib/validators";
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

    const part = await prisma.part.findFirst({
      where: { id, isActive: true },
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
    const parsed = partSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const existing = await prisma.part.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    const data = parsed.data;

    if (data.partNumber) {
      const dup = await prisma.part.findUnique({ where: { partNumber: data.partNumber } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
      }
    }

    if (data.barcodeValue) {
      const barcodeDup = await prisma.part.findUnique({ where: { barcodeValue: data.barcodeValue } });
      if (barcodeDup && barcodeDup.id !== id) {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
    }

    const part = await prisma.part.update({
      where: { id },
      data: {
        ...data,
        categoryId: data.categoryId ?? null,
      },
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
