import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const lowStockCandidates = await prisma.part.findMany({
      where: {
        isActive: true,
        quantity: { gt: 0 },
        minimumQuantity: { gt: 0 },
      },
      select: {
        id: true,
        partNumber: true,
        partName: true,
        quantity: true,
        minimumQuantity: true,
      },
      orderBy: { quantity: "asc" },
    });

    const lowStockFiltered = lowStockCandidates.filter(
      (p) => p.quantity <= p.minimumQuantity
    );

    const [
      totalParts,
      outOfStockCount,
      categoriesCount,
      todayMovements,
      recentMovements,
    ] = await Promise.all([
      prisma.part.count({ where: { isActive: true } }),
      prisma.part.count({ where: { isActive: true, quantity: 0 } }),
      prisma.category.count(),
      prisma.stockMovement.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.stockMovement.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          part: { select: { partNumber: true, partName: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

    return NextResponse.json({
      totalParts,
      lowStockCount: lowStockFiltered.length,
      outOfStockCount,
      categoriesCount,
      todayMovements,
      lowStockParts: lowStockFiltered.slice(0, 5),
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        type: m.type,
        quantityBefore: m.quantityBefore,
        quantityAfter: m.quantityAfter,
        quantityChange: m.quantityChange,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        part: m.part,
        user: m.user,
      })),
    });
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
    console.error("Mobile dashboard error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
});
