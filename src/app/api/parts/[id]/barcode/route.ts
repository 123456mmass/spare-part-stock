import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBarcodePng } from "@/lib/barcode";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const part = await prisma.part.findUnique({
      where: { id },
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
    console.error("Barcode generation error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างบาร์โค้ด" }, { status: 500 });
  }
}