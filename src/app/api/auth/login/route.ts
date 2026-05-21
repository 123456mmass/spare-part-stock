import { NextResponse } from "next/server";
import { verifyCredentials, AuthError } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validators";
import { rateLimitWeb, RateLimitError } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    await rateLimitWeb({ name: "login-web", maxRequests: 5, windowSeconds: 900 });
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const user = await verifyCredentials(username, password);

    if (!user) {
      // Security: Add delay to mitigate brute-force attacks
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    await createSession(user.id, user.username, user.role);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง" },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } }
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
}
