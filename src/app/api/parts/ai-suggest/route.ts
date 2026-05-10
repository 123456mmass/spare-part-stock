import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { suggestPartFromImage } from "@/lib/part-ai";

export async function POST(request: Request) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const suggestion = await suggestPartFromImage(file);
    return NextResponse.json({ suggestion });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json({ error: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
    }

    console.error("Part AI suggestion error:", error);
    return NextResponse.json(
      { error: "AI suggestion failed" },
      { status: 500 }
    );
  }
}
