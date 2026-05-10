import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireRole(["ADMIN"]);

    const body = await request.json();
    const { categories = false, parts = false, movements = false, users = false } = body;

    if (!categories && !parts && !movements && !users) {
      return NextResponse.json({ error: "No option selected" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (movements) {
        await tx.stockMovement.deleteMany({});
      }

      if (parts) {
        if (!movements) {
          await tx.stockMovement.deleteMany({});
        }
        await tx.part.deleteMany({});
      }

      if (categories) {
        if (!parts) {
          await tx.part.updateMany({ data: { categoryId: null } });
        }
        await tx.category.deleteMany({});
      }

      if (users) {
        await tx.stockMovement.deleteMany({ where: { userId: { not: user.id } } });
        await tx.user.deleteMany({ where: { id: { not: user.id } } });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Clear DB error:", error);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
}