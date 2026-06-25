import { NextResponse } from "next/server";
import { requireRoleFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireRoleFromRequest(request, ["ADMIN"]);

    const body = await request.json();
    const { categories = false, parts = false, movements = false, users = false } = body;

    if (!categories && !parts && !movements && !users) {
      return NextResponse.json({ error: "No option selected" }, { status: 400 });
    }

    // Audit trail for a destructive operation (admin-only, but logged so the
    // who/what/when is recoverable from server logs).
    console.warn(
      `[clear-db] admin=${user.username}(${user.id}) options=${JSON.stringify({ categories, parts, movements, users })}`,
    );

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
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile clear DB error:", error);
    return NextResponse.json({ error: "Failed to clear database" }, { status: 500 });
  }
});