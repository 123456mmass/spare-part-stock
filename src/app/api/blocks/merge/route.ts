import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { mergeBlocks } from "@/lib/blocks";

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN"]);
    const body = await request.json();
    const { sourceNames, target } = body;

    if (!Array.isArray(sourceNames) || sourceNames.length < 2) {
      return NextResponse.json({ error: "ต้องเลือกอย่างน้อย 2 บล็อกเพื่อรวม" }, { status: 400 });
    }
    if (!target || typeof target !== "string" || !target.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อบล็อกเป้าหมาย" }, { status: 400 });
    }

    const result = await mergeBlocks(sourceNames, target.trim());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("Error merging blocks:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการรวมบล็อก" }, { status: 500 });
  }
}
