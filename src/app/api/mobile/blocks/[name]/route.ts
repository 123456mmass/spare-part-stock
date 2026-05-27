import { NextResponse } from "next/server";
import { requireRoleFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { renameBlock, deleteBlock } from "@/lib/blocks";

export const OPTIONS = corsOptions();

export const PATCH = withCors(async (request: Request, { params }: { params: Promise<{ name: string }> }) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
    const { name } = await params;
    const body = await request.json();
    const { newName } = body;

    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อบล็อกใหม่" }, { status: 400 });
    }

    const result = await renameBlock(decodeURIComponent(name), newName.trim());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile block rename error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเปลี่ยนชื่อบล็อก" }, { status: 500 });
  }
});

export const DELETE = withCors(async (request: Request, { params }: { params: Promise<{ name: string }> }) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
    const { name } = await params;
    const result = await deleteBlock(decodeURIComponent(name));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile block delete error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบบล็อก" }, { status: 500 });
  }
});
