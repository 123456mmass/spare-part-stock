import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { suggestPartFromImage } from "@/lib/part-ai";

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const suggestion = await suggestPartFromImage(file);
    return NextResponse.json({ suggestion });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message === "Forbidden") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    console.error("Part AI suggestion error:", error);
    return NextResponse.json(
      { error: "AI suggestion failed" },
      { status: 500 }
    );
  }
}
