import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embedImageWithMetadata, cosineSimilarity, bytesToFloat32 } from "@/lib/embeddings";

const MAX_SIZE = 5 * 1024 * 1024;
const TOP_K = 5;
const MIN_SIMILARITY = 0.5;

export async function POST(request: Request) {
  try {
    await requireAuth();

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

    let queryEmbedding: Awaited<ReturnType<typeof embedImageWithMetadata>>;
    try {
      queryEmbedding = await embedImageWithMetadata(buffer, "query");
    } catch (err) {
      console.error("embedImage failed:", (err as Error).message);
      return NextResponse.json({ error: "ระบบค้นหาด้วยรูปไม่พร้อมใช้งาน" }, { status: 503 });
    }

    const parts = await prisma.part.findMany({
      where: {
        isActive: true,
        imageEmbedding: { not: null },
        imageEmbeddingProvider: queryEmbedding.provider,
        imageEmbeddingModel: queryEmbedding.model,
      },
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

    const minSimilarity = queryEmbedding.provider === "voyage" ? 0.35 : MIN_SIMILARITY;
    const matches = parts
      .map((p) => {
        const vec = bytesToFloat32(p.imageEmbedding as Buffer);
        const similarity = cosineSimilarity(queryEmbedding.vector, vec);
        const { imageEmbedding, ...part } = p;
        void imageEmbedding;
        return { part, similarity };
      })
      .filter((m) => m.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_K);

    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("search-by-image error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการค้นหา" }, { status: 500 });
  }
}
