import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stockMovementSchema } from "@/lib/validators";
import { requireAuth } from "@/lib/auth";
import { createStockMovement, StockError } from "@/lib/stock";
import { notifyLowStock } from "@/lib/notifications";
import { exportMovementsToExcel } from "@/lib/excel";

export async function GET(request: Request) {
  try {
    await requireAuth();
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
        part: { select: { id: true, partNumber: true, partName: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(movements);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
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

    const movement = await createStockMovement({ partId, userId: user.id, type, quantity, note });

    await notifyLowStock(partId);

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "PASSWORD_CHANGE_REQUIRED") {
        return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
      }
      if (error instanceof StockError) {
        if (error.message === "PART_NOT_FOUND") {
          return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
        }
        if (error.message === "INSUFFICIENT_STOCK") {
          return NextResponse.json({ error: "จำนวนอะไหล่ไม่เพียงพอ" }, { status: 400 });
        }
        if (error.message === "NEGATIVE_STOCK") {
          return NextResponse.json({ error: "จำนวนอะไหล่ต้องไม่ติดลบ" }, { status: 400 });
        }
        if (error.message === "CONCURRENT_MODIFICATION") {
          return NextResponse.json(
            { error: "ข้อมูลถูกแก้ไขพร้อมกัน กรุณาลองใหม่อีกครั้ง" },
            { status: 409 }
          );
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