import path from "path";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "./prisma";
import { generatePartBarcodeValue } from "./barcode";

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

export type PartAiSuggestion = z.infer<typeof aiSuggestionSchema> & {
  categoryId: string | null;
  matchedCategoryName: string | null;
};

function gatewayBaseUrl() {
  return (
    process.env.SPARE_PART_AI_GATEWAY_URL ||
    process.env.LLM_GATEWAY_BASE_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
}

function gatewayModel() {
  return process.env.SPARE_PART_AI_MODEL || process.env.LLM_GATEWAY_MODEL || "gemini-3-flash";
}

function gatewayKey() {
  const key =
    process.env.SPARE_PART_AI_GATEWAY_KEY || process.env.LLM_GATEWAY_API_KEY || "";
  if (!key) {
    console.error(
      "CRITICAL: No AI gateway key configured. Set SPARE_PART_AI_GATEWAY_KEY or LLM_GATEWAY_API_KEY in environment."
    );
  }
  return key;
}

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

function extractTextFromAnthropic(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .join("\n")
    .trim();
}

function parseJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  if (start === -1) {
    throw new Error("AI did not return a JSON object");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) {
      return JSON.parse(raw.slice(start, i + 1)) as unknown;
    }
  }

  throw new Error("AI returned incomplete JSON");
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
    JSON.stringify({
      partNumber: "string, part code/model/SKU printed on the part or label",
      partName: "string, format: Brand - Part Name in English (e.g. Schneider - Contactor, Mitsubishi - Inverter, SKF - Ball Bearing)",
      description: "string, format: [Brand] [Type] [Model], [Specs], [Standard], ใช้กับ[Application]",
      categoryName: "string, REQUIRED — use existing category if match, otherwise suggest a new Thai category name (e.g. อุปกรณ์ไฟฟ้า, วาล์ว, มอเตอร์, ตลับลูกปืน, เซ็นเซอร์). NEVER leave empty.",
      subcategory: "string, specific part type in English (e.g. Contactor, Breaker, Fuse, Relay, Inverter, Ball Bearing, Solenoid Valve)",
      location: "string",
      quantity: 0,
      minimumQuantity: 0,
      unit: "pcs",
      barcodeValue: "string or null. Priority: (1) read barcode/QR number from image, (2) if no barcode but Serial Number (SN) is visible, use the SN instead, (3) null if nothing found",
      confidence: 0.0,
      notes: "string, short uncertainty note",
    }),
  ].join("\n");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  const apiKey = gatewayKey();
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${gatewayBaseUrl()}/v1/messages`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: gatewayModel(),
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: resizedBuffer.toString("base64"),
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("AI gateway error:", response.status, body.substring(0, 200));
    throw new Error(`AI gateway returned ${response.status}`);
  }

  const rawJson = await response.json();
  const text = extractTextFromAnthropic(rawJson);

  // Debug: log what AI returned if JSON parsing fails
  let parsed;
  try {
    parsed = aiSuggestionSchema.parse(parseJsonObject(text));
  } catch (parseErr) {
    console.error("AI raw response text:", text.substring(0, 500));
    throw parseErr;
  }
  const resolved = await resolveCategory(parsed.categoryName ?? "");

  const barcodeValue = scannedBarcode || parsed.barcodeValue?.trim() || generatePartBarcodeValue(parsed.partNumber ?? parsed.partName ?? "");

  return {
    ...parsed,
    barcodeValue,
    categoryId: resolved.categoryId ?? categoryId,
    matchedCategoryName: resolved.matchedCategoryName ?? matchedCategoryName,
  };
}
