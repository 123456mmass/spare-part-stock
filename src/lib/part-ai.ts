import path from "path";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "./prisma";
import { generatePartBarcodeValue } from "./barcode";
import { callPartAi, parseJsonObject, type AiContentBlock } from "./ai-client";

const MAX_AI_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif", "image/tiff", "image/bmp", "image/gif"]);

const aiSuggestionSchema = z.object({
  partNumber: z.string().trim().nullable().optional().transform(v => v || ""),
  partName: z.string().trim().nullable().optional().transform(v => v || ""),
  description: z.string().trim().nullable().optional().transform(v => v || ""),
  categoryName: z.string().trim().nullable().optional().transform(v => v || ""),
  subcategory: z.string().trim().nullable().optional().transform(v => v || ""),
  location: z.string().trim().nullable().optional().transform(v => v || ""),
  quantity: z.coerce.number().int().min(0).nullable().optional().transform(v => v || 0),
  minimumQuantity: z.coerce.number().int().min(0).nullable().optional().transform(v => v || 0),
  unit: z.string().trim().nullable().optional().transform(v => v || "pcs"),
  barcodeValue: z.string().trim().nullable().optional().transform(v => v || null),
  confidence: z.coerce.number().min(0).nullable().optional().transform(v => !v ? 0.8 : v > 1 ? v / 100 : v),
  notes: z.string().trim().nullable().optional().transform(v => v || ""),
});

const suggestionJsonShape = {
  partNumber: "string, part code/model/SKU printed on the part or label",
  partName:
    "string, format: Brand - Part Name in English (e.g. Schneider - Contactor, Mitsubishi - Inverter, SKF - Ball Bearing)",
  description:
    "string, format: [Brand] [Type] [Model], [Specs], [Standard], ใช้กับ[Application]",
  categoryName:
    "string, REQUIRED — use existing category if match, otherwise suggest a new Thai category name (e.g. อุปกรณ์ไฟฟ้า, วาล์ว, มอเตอร์, ตลับลูกปืน, เซ็นเซอร์). NEVER leave empty.",
  subcategory:
    "string, specific part type in English (e.g. Contactor, Breaker, Fuse, Relay, Inverter, Ball Bearing, Solenoid Valve)",
  location: "string",
  quantity: 0,
  minimumQuantity: 0,
  unit: "pcs",
  barcodeValue:
    "string or null. Priority: (1) read barcode/QR number from image, (2) if no barcode but Serial Number (SN) is visible, use the SN instead, (3) null if nothing found",
  confidence: 0.0,
  notes: "string, short uncertainty note",
};

export type PartAiSuggestion = z.infer<typeof aiSuggestionSchema> & {
  categoryId: string | null;
  matchedCategoryName: string | null;
};

function mediaTypeFromFile(file: File) {
  // First check actual MIME type from the File object
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;
  // Fallback for Flutter or other mobile libs that may send wrong MIME or non-standard extension
  if (!file.type || file.type === "application/octet-stream" || file.type === "image/*") {
    const ext = path.extname(file.name).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".webp") return "image/webp";
    // Flutter image_picker creates temp files with .helic extension
    if (ext === ".helic") return "image/jpeg";
  }
  // Last resort: try extension again
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  // Flutter temp files may have no extension or .helic — default to jpeg
  return "image/jpeg";
}

async function resolveCategory(categoryName: string) {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const normalized = categoryName.trim().toLowerCase();
  const match = normalized
    ? categories.find((category) => category.name.trim().toLowerCase() === normalized)
    : null;

  return {
    categories,
    categoryId: match?.id ?? null,
    matchedCategoryName: match?.name ?? null,
  };
}

export async function suggestPartFromImage(file: File): Promise<PartAiSuggestion> {
  const mediaType = mediaTypeFromFile(file);
  if (!mediaType) {
    throw new Error("File must be JPG, PNG, or WebP");
  }

  // Resize and compress image before sending to AI to prevent OOM and reduce latency
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  if (originalBuffer.length > MAX_AI_IMAGE_SIZE) {
    throw new Error("File must be 5MB or smaller");
  }
  const resizedBuffer = await sharp(originalBuffer)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .png({ quality: 80 })
    .toBuffer();

  // Try to read barcode/QR from image before calling AI
  let scannedBarcode: string | null = null;
  try {
    const { readBarcodesFromImageData } = await import("zxing-wasm/reader");
    const { data: rawPixels, info } = await sharp(originalBuffer)
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const imageData = { data: new Uint8ClampedArray(rawPixels.buffer), width: info.width, height: info.height, colorSpace: "srgb" as const };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await readBarcodesFromImageData(imageData as any, { formats: ["EAN-13", "EAN-8", "Code128", "Code39", "QRCode", "DataMatrix", "ITF"] });
    if (results.length > 0 && results[0].text) {
      scannedBarcode = results[0].text.trim();
    }
  } catch {
    // barcode scan failed — AI will handle it
  }

  const { categories, categoryId, matchedCategoryName } = await resolveCategory("");
  const categoryNames = categories.map((category) => category.name).join(", ") || "none";

  const prompt = [
    "You are an inventory assistant for a spare-part stock system. You have expert knowledge of industrial parts, brands, and standards.",
    "Inspect the image and return only one JSON object. Do not include markdown.",
    "Use concise Thai or English values based on the visible part label/text.",
    "If a field is unknown, use an empty string, null, or 0. Do not invent serial numbers.",
    "For description: include brand, type/category, standard (e.g. IEC, DIN, JIS), rated specs (voltage/current/size), and typical application. Use your knowledge — e.g. LC1D09 → 'Schneider Electric TeSys D contactor, 9A, 3-pole, 220VAC coil, IEC/EN 60947, ใช้ควบคุมมอเตอร์/ปั๊ม'",
    "For barcodeValue: If you can see a barcode or QR code in the image, try to read the number beneath/beside it. If not readable, return null.",
    scannedBarcode ? `NOTE: Barcode already scanned from image: "${scannedBarcode}". Use this as barcodeValue.` : "",
    `Existing categories: ${categoryNames}`,
    "JSON schema:",
    JSON.stringify(suggestionJsonShape),
  ].join("\n");

  const aiContent: AiContentBlock[] = [
    {
      type: "image",
      imageBase64: resizedBuffer.toString("base64"),
      mediaType: "image/png",
    },
    { type: "text", text: prompt },
  ];

  let result;
  try {
    result = await callPartAi(aiContent, { maxTokens: 4096, temperature: 0, timeoutMs: 60_000 });
  } catch (err) {
    console.error("AI gateway error:", (err as Error).message);
    throw new Error(`AI gateway returned error: ${(err as Error).message}`);
  }

  const text = result.text;

  const parsed = await parsePartSuggestion(text);
  const resolved = await resolveCategory(parsed.categoryName ?? "");

  const barcodeValue = scannedBarcode || parsed.barcodeValue?.trim() || generatePartBarcodeValue(parsed.partNumber ?? parsed.partName ?? "");

  return {
    ...parsed,
    barcodeValue,
    categoryId: resolved.categoryId ?? categoryId,
    matchedCategoryName: resolved.matchedCategoryName ?? matchedCategoryName,
  };
}

async function parsePartSuggestion(text: string) {
  try {
    return aiSuggestionSchema.parse(parseJsonObject(text));
  } catch (parseErr) {
    console.error("AI raw response text:", text.substring(0, 500));
    if (!text.trim()) throw parseErr;

    const repairPrompt = [
      "Convert the following AI output into one valid JSON object for a spare-part inventory suggestion.",
      "Return JSON only. Do not include markdown or explanation.",
      "Do not invent values that are not present. Unknown fields should be empty string, null, or 0.",
      "Schema:",
      JSON.stringify(suggestionJsonShape),
      "AI output:",
      text.slice(0, 3000),
    ].join("\n");

    try {
      const repaired = await callPartAi(
        [{ type: "text", text: repairPrompt }],
        { maxTokens: 1200, temperature: 0, timeoutMs: 30_000 },
      );
      return aiSuggestionSchema.parse(parseJsonObject(repaired.text));
    } catch (repairErr) {
      console.error(
        "AI suggestion JSON repair failed:",
        repairErr instanceof Error ? repairErr.message : repairErr,
      );
      throw parseErr;
    }
  }
}
