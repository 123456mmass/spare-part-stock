import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { importPartsFromExcelWithAi } from "@/lib/excel-ai";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    const result = await importPartsFromExcelWithAi(Buffer.from(await file.arrayBuffer()), user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }
    console.error("Mobile AI Excel import error:", error);
    return NextResponse.json({ error: "AI Excel import failed" }, { status: 500 });
  }
});
