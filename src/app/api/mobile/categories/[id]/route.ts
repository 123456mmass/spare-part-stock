import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const DELETE = withCors(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      await tx.part.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
      await tx.category.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile delete category error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบหมวดหมู่" }, { status: 500 });
  }
});