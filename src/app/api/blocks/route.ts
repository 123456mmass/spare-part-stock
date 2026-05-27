import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listBlocks } from "@/lib/blocks";

export async function GET() {
  try {
    await requireAuth();
    const blocks = await listBlocks();
    return NextResponse.json(blocks);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("Error listing blocks:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลบล็อก" }, { status: 500 });
  }
}
