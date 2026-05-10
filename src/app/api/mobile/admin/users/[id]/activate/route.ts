import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const admin = await requireAuthFromRequest(request);
    if (admin.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้นี้" }, { status: 404 });
    }

    if (id === admin.id) {
      return NextResponse.json({ error: "ไม่สามารถเปิดใช้งานตัวเองได้" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mobile activate user error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
