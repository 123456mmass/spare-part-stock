import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

// Sync stub for future offline support.
// Currently returns 501 — accepts auth but does not process mutations.
// When implementing offline sync:
// - Accept { mutations: [...], lastSyncAt } body
// - Require clientMutationId on each mutation for idempotency
// - Deduplicate by clientMutationId before applying
// - Return { applied: n, skipped: n, lastSyncAt }
export const POST = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    return NextResponse.json(
      {
        status: "not_implemented",
        message: "Sync endpoint is reserved for future offline support",
      },
      { status: 501 }
    );
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
    console.error("Mobile sync error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
});