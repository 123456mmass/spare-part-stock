import { NextResponse } from "next/server";
import { generatePartsExportWorkbook } from "@/lib/excel-export";
import { prisma } from "@/lib/prisma";
import { verifyLineExportToken } from "@/lib/line-chat/export-token";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const payload = await verifyLineExportToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive || user.mustChangePassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { buffer, filename } = await generatePartsExportWorkbook({
      format: payload.format,
      plant: payload.plant,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("LINE export error:", error);
    return NextResponse.json({ error: "Export link is invalid or expired" }, { status: 401 });
  }
}
