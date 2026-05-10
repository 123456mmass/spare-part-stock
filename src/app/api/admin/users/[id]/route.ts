import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { updateUserSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireRole(["ADMIN"]);
    const { id } = await params;

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    // Self-protection: admin cannot demote/deactivate themselves
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "ไม่สามารถแก้ไขข้อมูลของตัวเองได้" },
        { status: 400 }
      );
    }

    const { name, role, isActive } = parsed.data;

    // Last admin protection
    if (
      target.role === "ADMIN" &&
      (role === "STAFF" || isActive === false)
    ) {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "ไม่สามารถเปลี่ยนแปลงได้ เนื่องจากนี่คือผู้ดูแลระบบคนสุดท้าย" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, role, isActive },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireRole(["ADMIN"]);
    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { movements: true } } },
    });
    if (!target) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    // Self-protection
    if (currentUser.id === id) {
      return NextResponse.json(
        { error: "ไม่สามารถลบผู้ใช้ของตัวเองได้" },
        { status: 400 }
      );
    }

    // Hard delete only if zero movements
    if (target._count.movements > 0) {
      return NextResponse.json(
        { error: "ไม่สามารถลบผู้ใช้นี้ได้ เนื่องจากมีประวัติการเคลื่อนไหวสต็อก กรุณาปิดใช้งานแทน" },
        { status: 400 }
      );
    }

    // Last admin protection
    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}