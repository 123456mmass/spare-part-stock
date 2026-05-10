import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
import { requireAuthFromRequest } from "@/lib/auth";
import { createStockMovement, StockError } from "@/lib/stock";
import { corsOptions, withCors } from "@/lib/cors";
import { exportMovementsToExcel } from "@/lib/excel";

export const OPTIONS = corsOptions();

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const { searchParams } = new URL(request.url);
    const exportFlag = searchParams.get("export");

    if (exportFlag === "true") {
      const buffer = await exportMovementsToExcel();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=movements.xlsx",
        },
      });
    }

    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const partId = searchParams.get("partId");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (partId) where.partId = partId;
    if (type) where.type = type;

    const movements = await prisma.stockMovement.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        part: { select: { partNumber: true, partName: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({ movements });
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
    console.error("Mobile movements error:", error);
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
    const parsed = stockMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { partId, type, quantity, note } = parsed.data;

    // Role enforcement: STAFF can only STOCK_IN and STOCK_OUT
    if (user.role === "STAFF" && type === "ADJUSTMENT") {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์ในการปรับยอดสินค้า" },
        { status: 403 }
      );
    }

    const movement = await createStockMovement({ partId, userId: user.id, type, quantity, note });

    return NextResponse.json(
      { movement, partQuantity: movement.part.quantity },
      { status: 201 }
    );
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
    if (error instanceof StockError) {
      if (error.message === "PART_NOT_FOUND") {
        return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
      }
      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json({ error: "จำนวนสินค้าไม่เพียงพอ" }, { status: 400 });
      }
      if (error.message === "NEGATIVE_STOCK") {
        return NextResponse.json({ error: "จำนวนสินค้าต้องไม่ติดลบ" }, { status: 400 });
      }
    }
    console.error("Mobile create movement error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกการเคลื่อนไหว" },
      { status: 500 }
    );
  }
});