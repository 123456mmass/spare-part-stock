import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest } from "@/lib/auth";
import { generateTempPassword } from "@/lib/password";
import { corsOptions, withCors } from "@/lib/cors";
import bcrypt from "bcryptjs";

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
      return NextResponse.json({ error: "ไม่สามารถรีเซ็ตรหัสตัวเองได้" }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const hashed = await bcrypt.hash(tempPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashed, mustChangePassword: true },
    });

    return NextResponse.json({ success: true, message: "รีเซ็ตรหัสผ่านสำเร็จ", tempPassword });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 }
      );
    }
    console.error("Mobile reset password error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
