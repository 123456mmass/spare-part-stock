import { z } from "zod";

const integerLikeSchema = z
  .union([z.number().int(), z.string().trim()])
  .transform((value, ctx) => {
    if (typeof value === "number") {
      if (!Number.isInteger(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ต้องเป็นจำนวนเต็ม",
        });
        return z.NEVER;
      }
      return value;
    }

    if (!/^\d+$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ต้องเป็นจำนวนเต็ม",
      });
      return z.NEVER;
    }

    return Number.parseInt(value, 10);
  });

const importRowSchema = z.object({
  rowNum: z.number().int().min(2),
  partNumber: z.string().trim().min(1, "ต้องระบุรหัสอะไหล่"),
  partName: z.string().trim().min(1, "ต้องระบุชื่ออะไหล่"),
  description: z.string().trim().optional(),
  categoryName: z.string().trim().optional(),
  location: z.string().trim().optional(),
  quantity: integerLikeSchema,
  minimumQuantity: integerLikeSchema,
  unit: z.string().trim().min(1).default("pcs"),
  barcodeValue: z.string().trim().min(1).optional().nullable(),
});

export interface RawImportRow {
  rowNum: number;
  partNumber: string;
  partName: string;
  description?: string;
  categoryName?: string;
  subcategory?: string;
  plant?: string;
  location?: string;
  quantity: string | number;
  minimumQuantity: string | number;
  unit?: string;
  barcodeValue?: string | null;
}

export interface ValidatedImportRow {
  rowNum: number;
  partNumber: string;
  partName: string;
  description?: string;
  categoryName?: string;
  subcategory?: string;
  plant?: string;
  location?: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  barcodeValue?: string | null;
  finalBarcodeValue: string;
}

export function validateImportRows(
  rows: RawImportRow[],
  generateBarcodeValue: (partNumber: string) => string
) {
  const validatedRows: ValidatedImportRow[] = [];
  const errors: string[] = [];
  const seenPartNumbers = new Map<string, number>();
  const seenBarcodes = new Map<string, number>();

  for (const row of rows) {
    const parsed = importRowSchema.safeParse({
      ...row,
      description: row.description?.trim() || undefined,
      categoryName: row.categoryName?.trim() || undefined,
      location: row.location?.trim() || undefined,
      unit: row.unit?.trim() || "pcs",
      barcodeValue: row.barcodeValue?.trim() || null,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`แถว ${row.rowNum}: ${issue.message}`);
      }
      continue;
    }

    const normalized = parsed.data;

    if (normalized.quantity < 0) {
      errors.push(`แถว ${row.rowNum}: จำนวนต้องไม่น้อยกว่า 0`);
    }
    if (normalized.minimumQuantity < 0) {
      errors.push(`แถว ${row.rowNum}: จำนวนขั้นต่ำต้องไม่น้อยกว่า 0`);
    }
    if (normalized.quantity < 0 || normalized.minimumQuantity < 0) {
      continue;
    }

    const partNumberKey = normalized.partNumber.toUpperCase();
    if (seenPartNumbers.has(partNumberKey)) {
      // Same part — merge: sum quantity, keep higher minimumQuantity
      const existingIdx = validatedRows.findIndex(
        (r) => r.partNumber.toUpperCase() === partNumberKey
      );
      if (existingIdx >= 0) {
        validatedRows[existingIdx].quantity += normalized.quantity;
        validatedRows[existingIdx].minimumQuantity = Math.max(
          validatedRows[existingIdx].minimumQuantity,
          normalized.minimumQuantity
        );
      }
      continue;
    }
    seenPartNumbers.set(partNumberKey, row.rowNum);

    const finalBarcodeValue =
      normalized.barcodeValue || generateBarcodeValue(normalized.partNumber);
    const barcodeKey = finalBarcodeValue.toUpperCase();
    if (seenBarcodes.has(barcodeKey)) {
      errors.push(
        `แถว ${row.rowNum}: บาร์โค้ดซ้ำกับแถว ${seenBarcodes.get(barcodeKey)}`
      );
      continue;
    }
    seenBarcodes.set(barcodeKey, row.rowNum);

    validatedRows.push({
      ...normalized,
      plant: row.plant,
      subcategory: row.subcategory,
      finalBarcodeValue,
    });
  }

  return {
    rows: validatedRows,
    errors,
  };
}
