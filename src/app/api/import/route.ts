import { NextResponse } from "next/server";
import { importPartsFromExcel } from "@/lib/excel";
import { requireAuth, requireRole } from "@/lib/auth";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export async function POST(request: Request) {
  try {
    const user = await requireRole(["ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ที่อัปโหลด" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ไฟล์มีขนาดใหญ่เกิน 100MB" },
        { status: 400 }
      );
    }

    const isAllowedType = ALLOWED_TYPES.includes(file.type) || file.type === "" || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isAllowedType) {
      return NextResponse.json(
        { error: `กรุณาอัปโหลดไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น (ได้รับ ${file.type})` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await importPartsFromExcel(buffer, user.id);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (error.message === "PASSWORD_CHANGE_REQUIRED") {
        return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
      }
    }
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้า" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireAuth();

    const template = `Part Number,Part Name,Description,Category,Location,Quantity,Minimum Quantity,Unit
SP-001,ช้างเปลี่ยนถ่ายน้ำมันเครื่อง,ช้างเปลี่ยนถ่ายน้ำมันเครื่อง ขนาด 10 ตัน,อะไหล่เครื่องจักร,ชั้น A-1,10,5,pcs
SP-002,สายพานลำเลียง,สายพานลำเลียง ยาว 5 เมตร,สายพาน,ชั้น B-2,20,10,pcs`;

    return new NextResponse(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=template.csv",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" }, { status: 403 });
    }
    console.error("Template download error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
