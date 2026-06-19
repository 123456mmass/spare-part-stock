/**
 * Shared logic for multi-image part creation wizards.
 * Used by both the web (/parts/new) and LIFF (/liff/add-part) add-part pages.
 */

import { z } from "zod";

export const MAX_IMAGES = 10;

/**
 * Form schema for a single part entry in the wizard.
 * Complex cross-field validation (plant required unless special tool)
 * is done at submit time, not in the resolver, to keep zodResolver type-safe.
 */
export const wizardFormSchema = z.object({
  partNumber: z.string().optional(),
  partName: z.string().min(1, "กรุณากรอกชื่ออะไหล่").regex(/^[^<>]+$/, "ห้ามมี < หรือ >"),
  description: z.string().regex(/^[^<>]*$/, "ห้ามมี < หรือ >").optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  subcategory: z.string().optional(),
  plant: z.string().optional(),
  isSpecialToolPart: z.boolean().optional(),
  buildingId: z.string().min(1, "กรุณาเลือกอาคาร"),
  location: z.string().regex(/^[^<>]*$/, "ห้ามมี < หรือ >").optional(),
  quantity: z.number().min(0, "จำนวนต้องเป็น 0 ขึ้นไป"),
  minimumQuantity: z.number().min(0, "ขั้นต่ำต้องเป็น 0 ขึ้นไป"),
  unit: z.string().min(1, "กรุณากรอกหน่วย").regex(/^[^<>]+$/, "ห้ามมี < หรือ >"),
  barcodeValue: z.string().optional(),
});

export type WizardFormValues = z.infer<typeof wizardFormSchema>;

export const EMPTY_FORM: WizardFormValues = {
  partNumber: "",
  partName: "",
  description: "",
  categoryId: "",
  categoryName: "",
  subcategory: "",
  plant: "",
  isSpecialToolPart: false,
  buildingId: "",
  location: "",
  quantity: 0,
  minimumQuantity: 0,
  unit: "pcs",
  barcodeValue: "",
};

/** One image + its AI suggestion + form values in the wizard. */
export interface ImageEntry {
  file: File;
  preview: string;
  suggestion: Record<string, unknown> | null;
  formValues: WizardFormValues;
  analyzed: boolean;
}

export type WizardStep = "upload" | "review" | "summary";

/** Shape of AI suggestion returned by /api/parts/ai-suggest. */
interface PartSuggestion {
  partNumber?: string;
  partName?: string;
  description?: string;
  location?: string;
  unit?: string;
  barcodeValue?: string;
  subcategory?: string;
  plant?: string;
  buildingId?: string;
  isSpecialToolPart?: boolean;
  quantity?: number;
  minimumQuantity?: number;
  matchedCategoryName?: string;
  categoryName?: string;
  categoryId?: string;
}

/** Merge an AI suggestion into a partial form-values object. */
export function applySuggestionToValues(s: PartSuggestion | null): Partial<WizardFormValues> {
  if (!s) return {};
  const out: Partial<WizardFormValues> = {};
  if (s.partNumber) out.partNumber = s.partNumber;
  if (s.partName) out.partName = s.partName;
  if (s.description) out.description = s.description;
  if (s.location) out.location = s.location;
  if (s.unit) out.unit = s.unit;
  if (s.barcodeValue) out.barcodeValue = s.barcodeValue;
  if (s.subcategory) out.subcategory = s.subcategory;
  if (s.plant) out.plant = s.plant;
  if (s.buildingId) out.buildingId = s.buildingId;
  if (s.isSpecialToolPart !== undefined) out.isSpecialToolPart = s.isSpecialToolPart;
  if (Number.isFinite(s.quantity)) out.quantity = s.quantity as number;
  if (Number.isFinite(s.minimumQuantity)) out.minimumQuantity = s.minimumQuantity as number;
  if (s.categoryId) out.categoryId = s.categoryId;
  const cat = s.matchedCategoryName || s.categoryName;
  if (cat) out.categoryName = cat;
  return out;
}

/** Read a File as a data URL using Promise.withResolvers. */
export function readFileAsDataURL(file: File): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (typeof result === "string") resolve(result);
    else reject(new Error("Failed to read file as data URL"));
  };
  reader.onerror = () => reject(new Error("FileReader error"));
  reader.readAsDataURL(file);
  return promise;
}

/** Stock status badge helper. */
export function stockStatus(qty: number): { label: string; color: string } {
  if (qty <= 0) return { label: "หมด", color: "text-red-600" };
  return { label: String(qty), color: "text-green-600" };
}

/** Validate plant requirement — returns error message or null. */
export function validatePlant(values: WizardFormValues): string | null {
  if (!values.isSpecialToolPart && (!values.plant || values.plant.trim() === "")) {
    return "กรุณาเลือก Block";
  }
  return null;
}
