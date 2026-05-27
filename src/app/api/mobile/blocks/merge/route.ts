import { NextResponse } from "next/server";
import { requireRoleFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { mergeBlocks } from "@/lib/blocks";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
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
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile block merge error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการรวมบล็อก" }, { status: 500 });
  }
});
