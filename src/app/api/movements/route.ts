import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
import { requireAuth } from "@/lib/auth";
import { createStockMovement, StockError } from "@/lib/stock";
import { exportMovementsToExcel } from "@/lib/excel";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partId = searchParams.get("partId");
    const type = searchParams.get("type");
    const exportParam = searchParams.get("export");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (exportParam === "true") {
      const buffer = await exportMovementsToExcel();
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename=stock_movements_${new Date().toISOString().split("T")[0]}.xlsx`,
        },
      });
    }

    const where: Record<string, unknown> = {};

    if (partId) {
      where.partId = partId;
    }

    if (type) {
      where.type = type;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        part: { select: { partNumber: true, partName: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(movements);
  } catch (error) {
    console.error("Error fetching movements:", error);
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
    const parsed = stockMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { partId, type, quantity, note } = parsed.data;

    // Role enforcement: STAFF can only STOCK_IN and STOCK_OUT, ADMIN can also ADJUSTMENT
    if (user.role === "STAFF" && type === "ADJUSTMENT") {
      return NextResponse.json(
        { error: "คุณไม่มีสิทธิ์ในการปรับยอดสินค้า" },
        { status: 403 }
      );
    }

    const movement = await createStockMovement({ partId, userId: user.id, type, quantity, note });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    }
    console.error("Error creating movement:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึกการเคลื่อนไหว" },
      { status: 500 }
    );
  }
}