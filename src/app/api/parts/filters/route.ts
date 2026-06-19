import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/parts/filters - distinct Block (plant) + subcategory values across
// all active parts. Returned unfiltered so the parts list dropdowns stay stable
// (independent of the currently-applied filters).
export async function GET() {
  try {
    await requireAuth();
    const parts = await prisma.part.findMany({
      where: { isActive: true },
      select: { plant: true, subcategory: true },
    });
    const plants = [
      ...new Set(parts.map((p) => p.plant).filter((v): v is string => Boolean(v))),
    ].sort();
    const subcategories = [
      ...new Set(parts.map((p) => p.subcategory).filter((v): v is string => Boolean(v))),
    ].sort();
    return NextResponse.json({ plants, subcategories });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 },
      );
    }
    console.error("Error fetching part filters:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
