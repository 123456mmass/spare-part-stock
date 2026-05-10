import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, AuthError } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    // Get all candidate low-stock parts (pre-filtered)
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
    ]);

    return NextResponse.json({
      totalParts,
      lowStockCount: lowStockFiltered.length,
      outOfStockCount,
      categoriesCount,
      todayMovements,
      lowStockParts: lowStockFiltered.slice(0, 5),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
