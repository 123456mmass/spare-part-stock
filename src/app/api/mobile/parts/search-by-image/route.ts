import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { prisma } from "@/lib/prisma";
import { embedImage, cosineSimilarity, bytesToFloat32 } from "@/lib/embeddings";

const MAX_SIZE = 5 * 1024 * 1024;
const TOP_K = 5;
const MIN_SIMILARITY = 0.5;

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 400 });
    }
    if (!file.type.startsWith("image/") && file.type !== "application/octet-stream") {
      return NextResponse.json({ error: "ไฟล์ต้องเป็นรูปภาพ" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "ไฟล์ต้องมีขนาดไม่เกิน 5MB" }, { status: 413 });
    }

    let queryVec: Float32Array;
    try {
      queryVec = await embedImage(buffer);
    } catch (err) {
      console.error("embedImage failed:", (err as Error).message);
      return NextResponse.json({ error: "ระบบค้นหาด้วยรูปไม่พร้อมใช้งาน" }, { status: 503 });
    }

    const parts = await prisma.part.findMany({
      where: { isActive: true, imageEmbedding: { not: null } },
      select: {
        id: true,
        partNumber: true,
        partName: true,
        imageUrl: true,
        quantity: true,
        unit: true,
        location: true,
        plant: true,
        subcategory: true,
        imageEmbedding: true,
      },
    });

    const matches = parts
      .map((p) => {
        const vec = bytesToFloat32(p.imageEmbedding as Buffer);
        const similarity = cosineSimilarity(queryVec, vec);
        const { imageEmbedding, ...part } = p;
        void imageEmbedding;
        return { part, similarity };
      })
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_K);

    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("mobile search-by-image error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการค้นหา" }, { status: 500 });
  }
});
