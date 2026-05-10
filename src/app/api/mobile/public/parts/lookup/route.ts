import { NextResponse } from "next/server";
import { resolvePartFromCode } from "@/lib/part-lookup";
import { corsOptions, withCors } from "@/lib/cors";
import { verifyMobileApiKey, AuthError } from "@/lib/auth";

export const OPTIONS = corsOptions();

function computeStockStatus(quantity: number, minimumQuantity: number): string {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= minimumQuantity) return "LOW_STOCK";
  return "IN_STOCK";
}

export const GET = withCors(async (request: Request) => {
  try {
    verifyMobileApiKey(request);
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "กรุณาระบุรหัสอะไหล่" }, { status: 400 });
    }

    const part = await resolvePartFromCode(code);
    if (!part) {
      return NextResponse.json({ error: "ไม่พบอะไหล่จากรหัสที่สแกน" }, { status: 404 });
    }

    return NextResponse.json({
      part: {
        id: part.id,
        partNumber: part.partNumber,
        partName: part.partName,
        description: part.description,
        quantity: part.quantity,
        minimumQuantity: part.minimumQuantity,
        unit: part.unit,
        location: part.location,
        imageUrl: part.imageUrl,
        barcodeValue: part.barcodeValue,
        category: part.category ? { id: part.category.id, name: part.category.name } : null,
        stockStatus: computeStockStatus(part.quantity, part.minimumQuantity),
      },
      canEdit: false,
      requiresLoginFor: ["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "EDIT_PART"],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
