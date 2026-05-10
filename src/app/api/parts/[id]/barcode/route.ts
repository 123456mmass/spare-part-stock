import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateBarcodePng } from "@/lib/barcode";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const part = await prisma.part.findFirst({
      where: { id, isActive: true },
      select: { barcodeValue: true },
    });

    if (!part || !part.barcodeValue) {
      return NextResponse.json({ error: "ไม่พบบาร์โค้ดสำหรับอะไหล่นี้" }, { status: 404 });
    }

    const buffer = await generateBarcodePng(part.barcodeValue);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Barcode generation error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างบาร์โค้ด" }, { status: 500 });
  }
}