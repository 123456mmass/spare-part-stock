import { NextResponse } from "next/server";
import { lineLinkSchema } from "@/lib/validators";
import {
  verifyCredentials,
  verifyMobileApiKey,
  AuthError,
} from "@/lib/auth";
import { signSessionToken } from "@/lib/session";
import { corsOptions, withCors } from "@/lib/cors";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  createFlexMessage,
  pushLineMessage,
  verifyLineIdToken,
  LineTokenError,
} from "@/lib/line";
import { createHelpFlex, createLoginSuccessFlex } from "@/lib/line-chat/flex-messages";
import { prisma } from "@/lib/prisma";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    verifyMobileApiKey(request);
    rateLimit(request, { name: "line-link", maxRequests: 5, windowSeconds: 900 });

    const body = await request.json();
    const parsed = lineLinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { idToken, username, password } = parsed.data;

    // Re-verify ID token server-side — never trust client
    const payload = await verifyLineIdToken(idToken);
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    if (channelId && payload.aud !== channelId) {
      return NextResponse.json(
        { error: "LINE_TOKEN_AUDIENCE_MISMATCH" },
        { status: 401 }
      );
    }

    // Check if this LINE user is already linked
    const existingLineAccount = await prisma.lineAccount.findUnique({
      where: { lineUserId: payload.sub },
      include: { user: true },
    });
    const existing =
      existingLineAccount?.user ??
      (await prisma.user.findUnique({ where: { lineUserId: payload.sub } }));
    if (existing) {
      return NextResponse.json(
        { error: "ALREADY_LINKED" },
        { status: 409 }
      );
    }

    // Verify internal credentials
    const user = await verifyCredentials(username, password);
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
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

    // Link LINE user ID. One internal account can have multiple LINE accounts.
    await prisma.lineAccount.upsert({
      where: { lineUserId: payload.sub },
      update: { userId: user.id },
      create: {
        lineUserId: payload.sub,
        userId: user.id,
      },
    });

    try {
      await pushLineMessage(payload.sub, [
        createFlexMessage("ล็อกอินสำเร็จ", createLoginSuccessFlex(user.name || user.username)),
        createFlexMessage("เมนู Spare Part Stock", createHelpFlex()),
      ]);
    } catch (error) {
      console.error("LINE post-link menu push failed:", error);
    }

    const { token, expiresAt } = await signSessionToken(
      user.id,
      user.username,
      user.role
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
        lineUserId: payload.sub,
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "มีการพยายามเชื่อมต่อมากเกินไป กรุณาลองใหม่ในภายหลัง" },
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
    console.error("LINE link error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเชื่อมต่อบัญชี LINE" },
      { status: 500 }
    );
  }
});
