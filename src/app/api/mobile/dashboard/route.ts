import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { getStorageSummary } from "@/lib/storage-summary";

export const OPTIONS = corsOptions();

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);
    const summary = await getStorageSummary();
    return NextResponse.json({
      ...summary,
      recentMovements: summary.recentMovements.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        {
          error: "PASSWORD_CHANGE_REQUIRED",
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน",
        },
        { status: 403 }
      );
    }
    console.error("Mobile dashboard error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
