import { NextResponse } from "next/server";
import { requireAuthFromRequest, AuthError } from "@/lib/auth";
import { getImageSession, updateImageSessionSuggestion } from "@/lib/ai-assistant/pending-actions";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

const PATCHABLE_FIELDS = new Set([
  "partNumber", "partName", "description", "categoryName",
  "subcategory", "plant", "buildingId", "buildingName",
  "location", "quantity", "minimumQuantity", "unit",
  "barcodeValue", "categoryId", "matchedCategoryName",
  "confidence", "notes", "status",
]);

export const GET = withCors(async (
  request: Request,
  context: { params: Promise<{ sid: string }> },
) => {
  try {
    const user = await requireAuthFromRequest(request);
    const { sid } = await context.params;
    const session = await getImageSession(sid);

    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "ไม่พบข้อมูลพรีวิว" }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      suggestion: session.suggestionJson || null,
      imageDataUrl: `data:image/jpeg;base64,${session.imageBase64}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ" },
      { status: 500 },
    );
  }
});

export const PATCH = withCors(async (
  request: Request,
  context: { params: Promise<{ sid: string }> },
) => {
  try {
    const user = await requireAuthFromRequest(request);
    const { sid } = await context.params;

    const session = await getImageSession(sid);
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ error: "ไม่พบข้อมูลเซสชัน" }, { status: 404 });
    }

    const body = await request.json() as Record<string, unknown>;

    // Only allowlist suggestion fields — prevent overwriting internal fields
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (PATCHABLE_FIELDS.has(key)) {
        patch[key] = value;
      }
    }

    // When editing from LIFF form, set status to editing (NOT saved — saved is only on DB write)
    if (!patch.status) {
      patch.status = "editing";
    }

    const currentSuggestion = session.suggestionJson || {};
    const updatedSuggestion = { ...currentSuggestion, ...patch };

    await updateImageSessionSuggestion(session.id, updatedSuggestion);

    // Return updated suggestion (no image data)
    return NextResponse.json({
      id: session.id,
      suggestion: updatedSuggestion,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "อัปเดตไม่สำเร็จ" },
      { status: 500 },
    );
  }
});
