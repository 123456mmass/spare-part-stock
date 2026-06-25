import { NextResponse } from "next/server";
import { lineVerifyTokenSchema } from "@/lib/validators";
import { verifyMobileApiKey, AuthError } from "@/lib/auth";
import { signSessionToken } from "@/lib/session";
import { corsOptions, withCors } from "@/lib/cors";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import { verifyLineIdToken, LineTokenError } from "@/lib/line";
import { prisma } from "@/lib/prisma";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    verifyMobileApiKey(request);
    rateLimit(request, { name: "line-auth", maxRequests: 5, windowSeconds: 900 });

    const body = await request.json();
    const parsed = lineVerifyTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = await verifyLineIdToken(parsed.data.idToken);
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    if (channelId && payload.aud !== channelId) {
      return NextResponse.json(
        { error: "LINE_TOKEN_AUDIENCE_MISMATCH" },
        { status: 401 }
      );
    }

    const linked = await prisma.lineAccount.findUnique({
      where: { lineUserId: payload.sub },
      include: { user: true },
    });
    const user =
      linked?.user ??
      (await prisma.user.findUnique({ where: { lineUserId: payload.sub } }));

    if (!user) {
      return NextResponse.json({ status: "UNLINKED" });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.mustChangePassword) {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 }
      );
    }

    const { token, expiresAt } = await signSessionToken(
      user.id,
      user.username,
      user.role,
      user.tokenVersion
    );

    return NextResponse.json({
      status: "OK",
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        lineUserId: user.lineUserId,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "มีการพยายามเข้าสู่ระบบมากเกินไป กรุณาลองใหม่ในภายหลัง" },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } }
      );
    }
    if (error instanceof LineTokenError) {
      return NextResponse.json(
        { error: "LINE token verification failed" },
        { status: 401 }
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("LINE verify-token error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการตรวจสอบ LINE Token" },
      { status: 500 }
    );
  }
});
