import { NextResponse } from "next/server";
import { requireAuthFromRequestAllowPasswordChange } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const GET = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequestAllowPasswordChange(request);

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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mobile /me error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
});