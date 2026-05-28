import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { getStorageSummary } from "@/lib/storage-summary";

export async function GET() {
  try {
    await requireAuth();
    const summary = await getStorageSummary();
    return NextResponse.json({
      ...summary,
      recentMovements: summary.recentMovements.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.message === "PASSWORD_CHANGE_REQUIRED") {
        return NextResponse.json(
          {
            error: "PASSWORD_CHANGE_REQUIRED",
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
