import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, AuthError } from "@/lib/auth";
import { listBuildings } from "@/lib/buildings";

const createSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่ออาคาร"),
  sortOrder: z.coerce.number().int().optional(),
});

export async function GET() {
  try {
    await requireAuth();
    const buildings = await listBuildings();
    return NextResponse.json(buildings);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.message === "PASSWORD_CHANGE_REQUIRED") {
        return NextResponse.json(
          {
            error: "PASSWORD_CHANGE_REQUIRED",
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error listing buildings:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN"]);
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const building = await prisma.building.create({
      data: {
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });

    return NextResponse.json(building, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating building:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
