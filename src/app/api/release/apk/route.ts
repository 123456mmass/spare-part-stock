import { NextResponse } from "next/server";
import { AuthError, requireAuth } from "@/lib/auth";
import { readReleaseApk, readReleaseInfo } from "@/lib/release";

export async function GET() {
  try {
    await requireAuth();
    const file = await readReleaseApk();
    if (!file) {
      return NextResponse.json(
        { error: "ยังไม่มีไฟล์ APK ให้ดาวน์โหลด" },
        { status: 404 }
      );
    }
    const info = await readReleaseInfo();
    const version = info?.version ?? "1.0.0";
    const filename = `sparepart_mobile-v${version}.apk`;

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.android.package-archive",
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 }
      );
    }
    console.error("Release apk download error:", error);
    return NextResponse.json(
      { error: "ไม่สามารถดาวน์โหลด APK ได้" },
      { status: 500 }
    );
  }
}
