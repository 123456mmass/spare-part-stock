import path from "path";
import { z } from "zod";
import { prisma } from "./prisma";
import { generatePartBarcodeValue } from "./barcode";

const MAX_AI_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const aiSuggestionSchema = z.object({
  partNumber: z.string().trim().optional().default(""),
  partName: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  categoryName: z.string().trim().optional().default(""),
  location: z.string().trim().optional().default(""),
  quantity: z.coerce.number().int().min(0).optional().default(0),
  minimumQuantity: z.coerce.number().int().min(0).optional().default(0),
  unit: z.string().trim().optional().default("pcs"),
  barcodeValue: z.string().trim().nullable().optional().default(null),
  confidence: z.coerce.number().min(0).max(1).optional().default(0),
  notes: z.string().trim().optional().default(""),
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
  return process.env.SPARE_PART_AI_GATEWAY_KEY || process.env.LLM_GATEWAY_API_KEY || "";
}

function mediaTypeFromFile(file: File) {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;
  const ext = path.extname(file.name).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "";
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

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_AI_IMAGE_SIZE) {
    throw new Error("File must be 5MB or smaller");
  }

  const { categories, categoryId, matchedCategoryName } = await resolveCategory("");
  const categoryNames = categories.map((category) => category.name).join(", ") || "none";

  const prompt = [
    "You are an inventory assistant for a spare-part stock system.",
    "Inspect the image and return only one JSON object. Do not include markdown.",
    "Use concise Thai or English values based on the visible part label/text.",
    "If a field is unknown, use an empty string, null, or 0. Do not invent serial numbers.",
    "Important: partNumber is the spare-part model/SKU/part code. barcodeValue is the machine-readable barcode/QR number visible on the part/label. Do not copy partNumber into barcodeValue unless the barcode text visibly matches it. If no barcode/QR is visible, return null and the system will generate one.",
    `Existing categories: ${categoryNames}`,
    "JSON schema:",
    JSON.stringify({
      partNumber: "string, part code/model/SKU printed on the part or label",
      partName: "string, clear spare part name",
      description: "string, material/shape/condition/visible details",
      categoryName: "string, best existing category name if possible",
      location: "string",
      quantity: 0,
      minimumQuantity: 0,
      unit: "pcs",
      barcodeValue: "string or null, only if a barcode/QR number is visible/readable",
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
    headers["x-api-key"] = apiKey;
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${gatewayBaseUrl()}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: gatewayModel(),
      max_tokens: 900,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: buffer.toString("base64"),
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway returned ${response.status}`);
  }

  const text = extractTextFromAnthropic(await response.json());
  const parsed = aiSuggestionSchema.parse(parseJsonObject(text));
  const resolved = await resolveCategory(parsed.categoryName);

  const barcodeValue = parsed.barcodeValue?.trim() || generatePartBarcodeValue(parsed.partNumber || parsed.partName);

  return {
    ...parsed,
    barcodeValue,
    categoryId: resolved.categoryId ?? categoryId,
    matchedCategoryName: resolved.matchedCategoryName ?? matchedCategoryName,
  };
}
