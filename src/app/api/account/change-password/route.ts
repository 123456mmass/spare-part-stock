import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthAllowPasswordChange } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const user = await requireAuthAllowPasswordChange();

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const currentUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!currentUser) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, currentUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    // Bump tokenVersion to invalidate any other sessions issued before this change.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false, tokenVersion: { increment: 1 } },
      select: { id: true, username: true, role: true, tokenVersion: true },
    });
    // Re-issue this session so the current user stays logged in with the new version.
    await createSession(updated.id, updated.username, updated.role, updated.tokenVersion);

    return NextResponse.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error changing password:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}