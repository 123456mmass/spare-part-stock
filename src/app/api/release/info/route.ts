import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { existsReleaseApk, readReleaseInfo } from "@/lib/release";

export async function GET() {
  try {
    await requireAuth();
    const info = await readReleaseInfo();
    if (!info || !(await existsReleaseApk())) {
      return NextResponse.json({ available: false });
    }
    return NextResponse.json({ available: true, ...info });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 }
      );
    }
    console.error("Release info error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถอ่านข้อมูลเวอร์ชันได้" },
      { status: 500 }
    );
  }
}
