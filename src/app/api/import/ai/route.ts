import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { importPartsFromExcelWithAi } from "@/lib/excel-ai";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireRole(["ADMIN"]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File is larger than 100MB" }, { status: 400 });
    }
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json({ error: "Please upload .xlsx or .xls" }, { status: 400 });
    }

    const plant = (formData.get("plant") as string)?.trim() || undefined;
    const result = await importPartsFromExcelWithAi(Buffer.from(await file.arrayBuffer()), user.id, plant);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      if (error.message === "Forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("AI Excel import error:", error);
    return NextResponse.json({ error: "AI Excel import failed" }, { status: 500 });
  }
}
