import { NextResponse } from "next/server";
import { requireAuthFromRequestAllowPasswordChange } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

// No-op logout: token revocation is not implemented.
// Flutter should delete the stored token locally.
// If server-side revocation is needed later, add a MobileSession table.
export const POST = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequestAllowPasswordChange(request);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mobile /logout error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
});