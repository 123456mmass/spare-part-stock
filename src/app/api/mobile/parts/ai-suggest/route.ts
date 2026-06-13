import { NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth";
import { corsOptions, withCors } from "@/lib/cors";
import { suggestPartFromImage } from "@/lib/part-ai";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    await requireAuthFromRequest(request);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const suggestion = await suggestPartFromImage(file);
    const { diagnostics, ...suggestionData } = suggestion;
    const diagnosticsEnabled = (process.env.AI_DIAGNOSTICS_ENABLED || "").toLowerCase() === "true";
    return NextResponse.json(
      diagnosticsEnabled
        ? { suggestion: suggestionData, diagnostics }
        : { suggestion: suggestionData },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED" },
        { status: 403 }
      );
    }

    console.error("Mobile part AI suggestion error:", error);
    return NextResponse.json(
      { error: "AI suggestion failed" },
      { status: 500 }
    );
  }
});
