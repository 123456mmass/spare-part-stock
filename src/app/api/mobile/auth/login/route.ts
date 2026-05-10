import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators";
import { verifyCredentials, verifyMobileApiKey, AuthError } from "@/lib/auth";
import { signSessionToken } from "@/lib/session";
import { corsOptions, withCors } from "@/lib/cors";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    rateLimit(request, { name: "login-mobile", maxRequests: 5, windowSeconds: 900 });
    verifyMobileApiKey(request);
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

    const { token, expiresAt } = await signSessionToken(user.id, user.username, user.role);

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
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
    console.error("Mobile login error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" },
      { status: 500 }
    );
  }
});