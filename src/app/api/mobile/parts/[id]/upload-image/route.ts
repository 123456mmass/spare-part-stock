import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest } from "@/lib/auth";
import { savePartImage } from "@/lib/uploads";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = await requireAuthFromRequest(request);

    const { id } = await params;

    const part = await prisma.part.findFirst({ where: { id, isActive: true } });
    if (!part) {
      return NextResponse.json({ error: "ไม่พบอะไหล่นี้" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && part.createdBy !== user.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เปลี่ยนรูปอะไหล่นี้ (ไม่ใช่ผู้สร้าง)" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    }

    // Accept any image type — sharp will convert
    if (!file.type.startsWith("image/") && file.type !== "application/octet-stream") {
      return NextResponse.json({ error: "ไฟล์ต้องเป็นรูปภาพ" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 5MB" }, { status: 400 });
    }

    const {
      url: imageUrl,
      embedding,
      embeddingProvider,
      embeddingModel,
      embeddingDimension,
    } = await savePartImage(buffer, file.name, id);

    await prisma.part.update({
      where: { id },
      data: {
        imageUrl,
        imageEmbedding: embedding,
        imageEmbeddingProvider: embeddingProvider,
        imageEmbeddingModel: embeddingModel,
        imageEmbeddingDimension: embeddingDimension,
      },
    });

    return NextResponse.json({ imageUrl });
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
    console.error("Mobile image upload error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัปโหลดรูป" },
      { status: 500 }
    );
  }
});
