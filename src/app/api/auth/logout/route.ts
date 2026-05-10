import { NextResponse } from "next/server";
import { verifyApiKey, AuthError } from "@/lib/auth";
import { deleteSession } from "@/lib/session";

export async function POST() {
  try {
    await verifyApiKey();
    await deleteSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
