import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generatePartsExportWorkbook } from "@/lib/excel-export";

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const { buffer, filename } = await generatePartsExportWorkbook({
      format: searchParams.get("format"),
      plant: searchParams.get("plant"),
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        {
          error: "PASSWORD_CHANGE_REQUIRED",
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน",
        },
        { status: 403 }
      );
    }
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
