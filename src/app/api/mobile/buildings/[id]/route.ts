import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const PATCH = withCors(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    const building = await prisma.building.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(building);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});

export const DELETE = withCors(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await requireRoleFromRequest(_request, ["ADMIN"]);
    const { id } = await params;
    const partCount = await prisma.part.count({
      where: { buildingId: id, isActive: true },
    });
    if (partCount > 0) {
      return NextResponse.json(
        { error: `มีอะไหล่ ${partCount} รายการในอาคารนี้` },
        { status: 400 }
      );
    }
    await prisma.building.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
