import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest, AuthError } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const GET = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAuthFromRequest(request);
    const { id } = await params;

    const part = await prisma.part.findFirst({
      where: { id, isActive: true },
      include: { category: true },
    });

    if (!part) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    return NextResponse.json({
      id: part.id,
      partNumber: part.partNumber,
      partName: part.partName,
      quantity: part.quantity,
      minimumQuantity: part.minimumQuantity,
      location: part.location,
      imageUrl: part.imageUrl,
      isActive: part.isActive,
      unit: part.unit,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 },
      );
    }
    console.error("LIFF part fetch error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
