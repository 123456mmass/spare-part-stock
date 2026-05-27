import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { partSchema } from "@/lib/validators";
import { requireAuthFromRequest, AuthError } from "@/lib/auth";
import { generatePartBarcodeValue, generatePartNumber } from "@/lib/barcode";
import { createStockMovement } from "@/lib/stock";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);

    const body = await request.json();
    const parsed = partSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { partName, description, categoryId, categoryName, subcategory, plant, location, quantity, minimumQuantity, unit, barcodeValue } = parsed.data;
    let { partNumber } = parsed.data;
    if (!partNumber || partNumber === "-") {
      partNumber = generatePartNumber();
    }
    const finalBarcodeValue = barcodeValue || generatePartBarcodeValue(partNumber);

    const part = await prisma.$transaction(async (tx) => {
      let resolvedCategoryId = categoryId || null;
      if (!resolvedCategoryId && categoryName) {
        const cat = await tx.category.upsert({
          where: { name: categoryName },
          create: { name: categoryName },
          update: {},
        });
        resolvedCategoryId = cat.id;
      }

      const created = await tx.part.create({
        data: {
          partNumber,
          partName,
          description,
          categoryId: resolvedCategoryId,
          subcategory: subcategory || null,
          plant: plant || null,
          createdBy: user.id,
          location,
          quantity: 0,
          minimumQuantity: minimumQuantity ?? 0,
          unit: unit || "pcs",
          barcodeValue: finalBarcodeValue,
        },
        include: { category: true },
      });

      if ((quantity ?? 0) > 0) {
        await createStockMovement(
          {
            partId: created.id,
            userId: user.id,
            type: "STOCK_IN",
            quantity: quantity ?? 0,
            note: "สร้างอะไหล่ใหม่",
          },
          tx,
        );
      }

      return tx.part.findUnique({
        where: { id: created.id },
        include: { category: true },
      });
    });

    return NextResponse.json(part, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PASSWORD_CHANGE_REQUIRED") {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน" },
        { status: 403 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } } } | undefined;
      const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
      const targetStr = Array.isArray(adapterFields)
        ? adapterFields.join(",")
        : Array.isArray(meta?.target)
          ? meta.target.join(",")
          : String(meta?.target ?? error.message ?? "");
      if (targetStr.includes("barcodeValue")) {
        return NextResponse.json({ error: "บาร์โค้ดนี้มีอยู่แล้ว" }, { status: 400 });
      }
      return NextResponse.json({ error: "รหัสอะไหล่นี้มีอยู่แล้ว" }, { status: 400 });
    }
    console.error("LIFF create part error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างอะไหล่" }, { status: 500 });
  }
});
