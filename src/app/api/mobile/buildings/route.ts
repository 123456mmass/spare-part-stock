import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest, requireRoleFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { listBuildings } from "@/lib/buildings";

export const OPTIONS = corsOptions();

const createSchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().optional(),
});

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);
    const buildings = await listBuildings();
    return NextResponse.json(buildings);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mobile buildings error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});

export const POST = withCors(async (request: Request) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }
    const building = await prisma.building.create({
      data: {
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });
    return NextResponse.json(building, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
