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

    const grouped = await prisma.part.groupBy({
      by: ["plant"],
      where: { isActive: true, isSpecialToolPart: false, plant: { not: null } },
      _count: { _all: true },
    });
    const blocks = grouped
      .filter((item): item is typeof item & { plant: string } => Boolean(item.plant))
      .map((item) => {
        const display = /^\d+$/.test(item.plant) ? `Block ${item.plant}` : item.plant;
        return { id: item.plant, name: display, partCount: item._count._all };
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

    const specialCount = await prisma.part.count({
      where: { isActive: true, isSpecialToolPart: true },
    });
    if (specialCount > 0) {
      blocks.push({ id: "special", name: "Special Tool Part", partCount: specialCount });
    }

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
