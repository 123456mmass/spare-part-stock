import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { renameBlock, deleteBlock } from "@/lib/blocks";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireRole(["ADMIN"]);
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
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("Error renaming block:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเปลี่ยนชื่อบล็อก" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await requireRole(["ADMIN"]);
    const { name } = await params;
    const result = await deleteBlock(decodeURIComponent(name));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (error.message === "PASSWORD_CHANGE_REQUIRED") return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("Error deleting block:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบบล็อก" }, { status: 500 });
  }
}
