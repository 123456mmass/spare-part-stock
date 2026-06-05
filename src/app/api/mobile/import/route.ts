import { NextResponse } from "next/server";
import { importPartsFromExcel } from "@/lib/excel";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "ไม่พบไฟล์ที่อัปโหลด" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ไฟล์มีขนาดใหญ่เกิน 50MB" },
        { status: 400 }
      );
    }

    const isAllowedType =
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel" ||
      file.type === "" ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls");

    if (!isAllowedType) {
      return NextResponse.json(
        { error: `กรุณาอัปโหลดไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น (ได้รับ ${file.type})` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const plant = (formData.get("plant") as string)?.trim() || undefined;

    const result = await importPartsFromExcel(buffer, user.id, plant);

    return NextResponse.json(result);
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
    console.error("Mobile import error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการนำเข้า" },
      { status: 500 }
    );
  }
});

export const GET = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const template =
      "Part Number,Part Name,Description,Category,Location,Quantity,Minimum Quantity,Unit\n" +
      "SP-001,ช้างเปลี่ยนถ่ายน้ำมันเครื่อง,ช้างเปลี่ยนถ่ายน้ำมันเครื่อง ขนาด 10 ตัน,อะไหล่เครื่องจักร,ชั้น A-1,10,5,pcs\n" +
      "SP-002,สายพานลำเลียง,สายพานลำเลียง ยาว 5 เมตร,สายพาน,ชั้น B-2,20,10,pcs";

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
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 }
      );
    }
    console.error("Mobile template error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
});
