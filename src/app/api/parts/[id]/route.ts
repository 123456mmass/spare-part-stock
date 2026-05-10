import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partSchema } from "@/lib/validators";
import { requireAuth, requireRole } from "@/lib/auth";

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
    await requireRole(["ADMIN"]);

    const { id } = await params;
    const body = await request.json();
    const parsed = partSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.partNumber) {
      const existing = await prisma.part.findFirst({
        where: {
          partNumber: data.partNumber,
          NOT: { id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "รหัสอะไหล่นี้มีอยู่แล้ว" },
          { status: 400 }
        );
      }
    }

    if (data.barcodeValue) {
      const dup = await prisma.part.findFirst({
        where: { barcodeValue: data.barcodeValue, id: { not: id } },
      });
      if (dup) {
        return NextResponse.json(
          { error: "บาร์โค้ดนี้มีอยู่แล้ว" },
          { status: 400 }
        );
      }
    }

    const part = await prisma.part.update({
      where: { id },
      data: {
        ...data,
        categoryId: data.categoryId || null,
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
    const user = await requireRole(["ADMIN"]);

    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const part = await tx.part.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.stockMovement.create({
        data: {
          partId: part.id,
          userId: user.id,
          type: "ADJUSTMENT",
          quantityBefore: part.quantity,
          quantityAfter: 0,
          quantityChange: -part.quantity,
          note: "ลบอะไหล่ (soft delete)",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
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
