import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/blocks - returns user-friendly Block options extracted from active
// parts' plant values. Matches the style of /api/buildings and
// /api/categories so the UI can render a <Select> for Block just like
// Building.
export async function GET() {
  try {
    await requireAuth();

    // Collect distinct plant values from active parts, then sort numerically
    // where possible ("1", "2", "10" …).
    const parts = await prisma.part.findMany({
      where: { isActive: true, plant: { not: null } },
      select: { plant: true },
      distinct: ["plant"],
    });
    const plants = parts.map((p) => p.plant).filter((v): v is string => Boolean(v));

    const blocks = plants
      .map((plant) => {
        // Display label: numeric plants become "Block N"; otherwise keep
        // the raw value capitalised.
        const display = /^\d+$/.test(plant) ? `Block ${plant}` : plant;
        return { id: plant, name: display };
      })
      .sort((a, b) => {
        const aNum = parseInt(a.id, 10);
        const bNum = parseInt(b.id, 10);
        const aIsNum = !isNaN(aNum);
        const bIsNum = !isNaN(bNum);
        if (aIsNum && bIsNum) return aNum - bNum;
        if (aIsNum) return -1;
        if (bIsNum) return 1;
        return a.name.localeCompare(b.name, "th");
      });

    return NextResponse.json(blocks);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 },
      );
    }
    console.error("Error listing blocks:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
