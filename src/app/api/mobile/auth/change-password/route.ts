import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequestAllowPasswordChange } from "@/lib/auth";
import { signSessionToken } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequestAllowPasswordChange(request);

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
    // Return a fresh bearer token carrying the new version so the mobile client
    // can replace its stored token without forcing a re-login.
    const { token, expiresAt } = await signSessionToken(
      updated.id,
      updated.username,
      updated.role,
      updated.tokenVersion,
    );

    return NextResponse.json({
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mobile change password error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
