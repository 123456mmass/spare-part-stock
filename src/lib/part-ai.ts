import path from "path";
import { z } from "zod";
import { normalizeImage } from "./image-normalize";
import { prisma } from "./prisma";
import { generatePartBarcodeValue } from "./barcode";
import { callPartAi, currentVisionModel, parseJsonObject, type AiContentBlock, type VisionDiagnostics } from "./ai-client";
import { bytesToFloat32, cosineSimilarity, embedImageWithMetadata } from "./embeddings";

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
  confidence: z.coerce.number().min(0).nullable().optional().transform(v => v == null ? 0.8 : v > 1 ? v / 100 : v),
  notes: z.string().trim().nullable().optional().transform(v => v || ""),
  partNumberCandidates: z.array(z.string()).nullable().optional().transform(v => v || []),
  partNumberConfidence: z.coerce.number().min(0).max(1).nullable().optional().transform(v => v ?? null),
  uncertainPartNumberChars: z.array(z.string()).nullable().optional().transform(v => v || []),
});

const suggestionJsonShape = {
  partNumber: "string, model/SKU/code from visible label ONLY. Empty string '' if nothing readable on the part. NEVER invent a part number from visual guess.",
  partName:
    "string, format: Brand - Type in English. If brand readable, use it (e.g. Schneider - Contactor). If brand NOT readable but type is, fill as 'Unknown Brand - <Type>' (e.g. Unknown Brand - Ball Bearing). NEVER leave partName empty — always infer type from visual shape.",
  description:
    "string, format: [Brand or 'Unknown'] [Type] [Model if visible], [Visual specs: color/size/pole count/material], [Standard if visible e.g. IEC/DIN/JIS], typical application. Always include visual observations even when no label is visible (color, terminal count, form factor, mounting style).",
  categoryName:
    "string, REQUIRED Thai category — NEVER leave empty. Classify visually: อุปกรณ์ไฟฟ้า, วาล์ว, มอเตอร์, ตลับลูกปืน, เซ็นเซอร์, อุปกรณ์นิวเมติกส์, สายไฟ/คอนเนคเตอร์, ฟิวส์, อุปกรณ์ควบคุม, แหล่งจ่ายไฟ, หรือ อะไหล่ as fallback.",
  subcategory:
    "string, REQUIRED English type — NEVER leave empty. Classify visually: Contactor, Relay, Breaker, Fuse, Bearing, Sensor, Solenoid Valve, Terminal Block, Pneumatic Fitting, Motor, Inverter, Switch, Power Supply, Cable, Connector, PLC, Timer, Push Button, Indicator Light, etc.",
  location: "string, empty if unknown",
  quantity: 1,
  minimumQuantity: 1,
  unit: "pcs",
  barcodeValue:
    "string or null. ONLY if barcode/QR number is clearly visible and readable. null otherwise. NEVER invent a barcode.",
  confidence:
    "number 0-1. Be honest: 0.85-0.95=model# clearly visible on label; 0.70-0.85=brand/type visible but no model#; 0.55-0.75=visual shape match only (system will auto-cap at 0.75 for provisional partNumber); 0.30-0.50=dark/blurry/partial view; 0.20=unusable image.",
  notes:
    "string, SHORT evidence summary (Thai or English). MUST state evidence source for each key field: 'label:', 'visual:', 'OCR:', 'barcode:'. Example: 'visual: Contactor 3P 1NO 1NC, label: Schneider LC1D09, OCR: 24V DC, barcode: scanned'. Keep under 200 chars.",
  partNumberCandidates:
    "array of strings, alternative possible model# readings when OCR characters are ambiguous. e.g. ['3RN2010-1CW30','3RN1010-1CW00']. Include only when characters are unclear and partNumberConfidence < 0.85. Empty array [] when confident or partNumber is empty.",
  partNumberConfidence:
    "number 0-1, YOUR certainty about the EXACT partNumber text. SEPARATE from overall confidence. 0.90-1.00=every character sharp and readable; 0.85-0.89=mostly clear but 1-2 chars slight doubt; BELOW 0.85=ambiguous — in this case MUST set partNumber='' and list alternatives in partNumberCandidates. Set null if partNumber is empty.",
  uncertainPartNumberChars:
    "array of strings, describe specific character positions where reading was uncertain and why. Format: ['char3: possibly 0 or O','char7: blurry/faint','char10: damaged/illegible']. Empty [] if all characters are clear and sharp.",
};

export type PartAiSuggestion = z.infer<typeof aiSuggestionSchema> & {
  categoryId: string | null;
  matchedCategoryName: string | null;
  diagnostics?: VisionDiagnostics;
};

type SuggestPartOptions = {
  allowDbFallback?: boolean;
};

// ── post-parse defaults ─────────────────────────────────────────────

const PROVISIONAL_TYPE_MAP: Record<string, string> = {
  contactor: "TMP-CON",
  relay: "TMP-RLY",
  breaker: "TMP-BRK",
  bearing: "TMP-BRG",
  "ball bearing": "TMP-BRG",
  "roller bearing": "TMP-BRG",
  sensor: "TMP-SEN",
  "solenoid valve": "TMP-SOL",
  "terminal block": "TMP-TRM",
  "pneumatic fitting": "TMP-PNF",
  motor: "TMP-MTR",
  inverter: "TMP-MTR",
  fuse: "TMP-FUS",
  connector: "TMP-CNN",
  "cable gland": "TMP-CNN",
  "push button": "TMP-RLY",
  plc: "TMP-MTR",
  timer: "TMP-RLY",
  switch: "TMP-BRK",
  "indicator light": "TMP-RLY",
  "power supply": "TMP-MTR",
  transformer: "TMP-MTR",
  busbar: "TMP-BRK",
  "circuit board": "TMP-MTR",
};

function random4(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/0/O/1 to avoid confusion
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function formatLocalDateYYYYMMDD(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export function generateProvisionalPartNumber(
  subcategory: string,
  dateStr?: string,
): string {
  const key = subcategory.trim().toLowerCase();
  const prefix = PROVISIONAL_TYPE_MAP[key] || "TMP-SPP";
  const date = dateStr || formatLocalDateYYYYMMDD();
  return `${prefix}-${date}-${random4()}`;
}

const NEGATIVE_EVIDENCE_WORDS = /\b(none|no label|not visible|unreadable|blurry|unknown|empty|absent|illegible|unclear)\b/i;

// Matches tokens that look like a real model/SKU: contains both letters AND digits
// Examples: LC1D09, MY2N, 6204ZZ, E2E-X5ME1, AB 123
// Does NOT match brand-only words: Schneider, Omron, SKF, Contactor
const MODEL_SKU_PATTERN = /^(?=[A-Z0-9-]*[0-9])(?=[A-Z0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{2,}$/i;

function segmentContainsModelSku(segment: string): boolean {
  // Split on spaces/commas, check each token
  const tokens = segment.split(/[\s,]+/).filter(Boolean);
  return tokens.some((t) => MODEL_SKU_PATTERN.test(t));
}

function segmentContainsPartNumber(segment: string, partNumber: string): boolean {
  // The partNumber itself must look like a model/SKU (mixed alpha+numeric).
  // Brand-only words like Schneider, Omron, SKF do NOT count as evidence.
  if (!MODEL_SKU_PATTERN.test(partNumber)) return false;
  const escaped = partNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i").test(segment);
}

export function hasPositivePartNumberEvidence(
  notes: string,
  partNumber: string,
): boolean {
  if (!partNumber || partNumber.trim().length === 0) return false;
  const n = notes.trim();
  if (!n) return false;

  // Extract the label: and OCR: segments — stop at next tag boundary
  const labelMatch = n.match(/label:\s*(.+?)(?=\s*,?\s*(?:ocr:|visual:|barcode:|label:|$))/i);
  const ocrMatch = n.match(/ocr:\s*(.+?)(?=\s*,?\s*(?:ocr:|visual:|barcode:|label:|$))/i);

  const labelText = labelMatch?.[1]?.trim() ?? "";
  const ocrText = ocrMatch?.[1]?.trim() ?? "";

  // label: segment — must not be negative AND must contain either the partNumber
  // itself or a token that looks like a real model/SKU (mixed alpha+numeric)
  let hasRealLabel = false;
  if (labelText && !NEGATIVE_EVIDENCE_WORDS.test(labelText)) {
    hasRealLabel =
      segmentContainsPartNumber(labelText, partNumber) ||
      segmentContainsModelSku(labelText);
  }

  let hasRealOcr = false;
  if (ocrText && !NEGATIVE_EVIDENCE_WORDS.test(ocrText)) {
    hasRealOcr =
      segmentContainsPartNumber(ocrText, partNumber) ||
      segmentContainsModelSku(ocrText);
  }

  // visible model keyword (not negative context)
  const visibleModelMatch = /\bvisible model\b/i.test(n);
  const nearNegative = /(no|not|none|unreadable|blurry|unclear)\s+(visible model|model)/i.test(n);
  const hasVisibleModel = visibleModelMatch && !nearNegative;

  return hasRealLabel || hasRealOcr || hasVisibleModel;
}

const LOW_STOCK_TYPES = new Set<string>([
  "bearing", "ball bearing", "roller bearing", "fuse", "sensor",
  "relay", "connector", "terminal block", "cable", "cable gland",
  "pneumatic fitting", "fitting", "terminal", "push button",
  "indicator light", "seal", "o-ring", "gasket",
]);

const ONE_UNIT_TYPES = new Set<string>([
  "motor", "inverter", "power supply", "breaker", "contactor",
  "solenoid valve", "plc", "timer", "switch", "busbar", "transformer",
  "circuit board",
]);

export function defaultMinQty(subcategory: string): number {
  const key = subcategory.trim().toLowerCase();
  if (LOW_STOCK_TYPES.has(key)) return 2;
  if (ONE_UNIT_TYPES.has(key)) return 1;
  return 1;
}

// Patterns that indicate the AI itself is uncertain about OCR/character reading.
// When these appear in notes, the partNumber is considered unreliable.
const OCR_UNCERTAINTY_PATTERN =
  /\b(ambiguous|uncertain|blurry|blurred|unclear|not fully readable|partially readable|hard to read|difficult to read|unsure|not certain|faint|degraded|worn|damaged|illegible|unreadable|not clear|character.*uncertain|char.*ambiguous)\b/i;

export function isPartNumberUncertain(
  notes: string,
  partNumberConfidence: number | null,
): boolean {
  // 1. Notes contain explicit uncertainty language → uncertain
  if (notes && OCR_UNCERTAINTY_PATTERN.test(notes)) return true;

  // 2. AI provided a partNumberConfidence below threshold → uncertain
  if (partNumberConfidence !== null && partNumberConfidence < 0.85) return true;

  return false;
}

export function applyPostParseDefaults(
  parsed: z.infer<typeof aiSuggestionSchema>,
  scannedBarcode: string | null,
): z.infer<typeof aiSuggestionSchema> {
  const cat = parsed.categoryName?.trim() || "อะไหล่";
  const sub = parsed.subcategory?.trim() || "";
  const pn = parsed.partNumber?.trim() || "";

  // partName: if empty but we have subcategory, fill with "Unknown Brand - <sub>"
  let partName = parsed.partName?.trim() || "";
  if (!partName && sub) {
    partName = `Unknown Brand - ${sub}`;
  } else if (!partName && cat !== "อะไหล่") {
    partName = `Unknown - ${cat}`;
  } else if (!partName) {
    partName = "Unknown - Spare Part";
  }

  // categoryName: ensure never empty
  const categoryName = cat;

  // unit: default
  const unit = parsed.unit?.trim() || "pcs";

  // minimumQuantity: per-type default if AI returned 0
  const minQty = (parsed.minimumQuantity ?? 0) > 0
    ? parsed.minimumQuantity
    : defaultMinQty(sub);

  // ── partNumber: never empty ──────────────────────────────────
  const pnConfidence = parsed.partNumberConfidence ?? null;
  const isUncertain = isPartNumberUncertain(parsed.notes ?? "", pnConfidence);
  const hasEvidence = hasPositivePartNumberEvidence(parsed.notes ?? "", pn);
  let finalPn = "";
  let isProvisional = false;

  if (isUncertain) {
    // OCR is unreliable — AI itself flagged ambiguity or blurry text
    if (scannedBarcode) {
      finalPn = scannedBarcode;
    } else {
      finalPn = generateProvisionalPartNumber(sub);
      isProvisional = true;
    }
  } else if (pn && hasEvidence) {
    // AI found a real model# with positive label/OCR/visible-model evidence
    // AND no uncertainty flags — trust it
    finalPn = pn;
  } else if (scannedBarcode) {
    // scannedBarcode always wins over AI guess when no positive evidence
    finalPn = scannedBarcode;
  } else {
    // nothing reliable — generate provisional
    finalPn = generateProvisionalPartNumber(sub);
    isProvisional = true;
  }

  // Cap confidence when provisional
  let confidence = parsed.confidence ?? 0.8;
  if (isProvisional && confidence > 0.75) {
    confidence = 0.75;
  }

  // Build notes
  const baseNotes = (parsed.notes || "").trim();
  let notes = baseNotes;

  // Append candidate info when OCR was uncertain (for human review)
  const candidates = parsed.partNumberCandidates ?? [];
  const uncertainChars = parsed.uncertainPartNumberChars ?? [];

  if (isUncertain) {
    const parts: string[] = [];
    if (pn) parts.push(`AI อ่านรหัส "${pn}" แต่ไม่ชัดเจน`);
    if (pnConfidence !== null) parts.push(`partNumberConfidence=${pnConfidence}`);
    if (candidates.length > 0) parts.push(`candidates=[${candidates.join(", ")}]`);
    if (uncertainChars.length > 0) parts.push(`uncertainChars=[${uncertainChars.join("; ")}]`);
    const uncertaintyDetail = parts.length > 0 ? `. ${parts.join(", ")}` : "";

    if (isProvisional) {
      const provNote = `partNumber เป็นรหัสชั่วคราวจากระบบ เนื่องจากอ่านรหัสไม่ชัดเจน${uncertaintyDetail}`;
      notes = baseNotes ? `${baseNotes}. ${provNote}` : provNote;
    } else if (scannedBarcode) {
      // Using barcode — still note the AI uncertainty
      const info = `ใช้รหัสจาก Barcode แทนเนื่องจาก AI อ่านรหัสไม่ชัดเจน${uncertaintyDetail}`;
      notes = baseNotes ? `${baseNotes}. ${info}` : info;
    }
  } else if (isProvisional) {
    const provNote = "partNumber เป็นรหัสชั่วคราวจากระบบ เนื่องจากไม่เห็นรหัสจริงบนรูป";
    // Preserve candidates for human review even in provisional case
    const extras: string[] = [];
    if (candidates.length > 0) extras.push(`candidates=[${candidates.join(", ")}]`);
    if (uncertainChars.length > 0) extras.push(`uncertainChars=[${uncertainChars.join("; ")}]`);
    const candidateInfo = extras.length > 0 ? `. ${extras.join(", ")}` : "";
    notes = baseNotes ? `${baseNotes}. ${provNote}${candidateInfo}` : `${provNote}${candidateInfo}`;
  } else if (candidates.length > 0 || uncertainChars.length > 0) {
    // AI provided candidates/chars but we're confident in the main pn — still preserve info
    const extras: string[] = [];
    if (candidates.length > 0) extras.push(`candidates=[${candidates.join(", ")}]`);
    if (uncertainChars.length > 0) extras.push(`uncertainChars=[${uncertainChars.join("; ")}]`);
    if (extras.length > 0) {
      notes = baseNotes ? `${baseNotes}. ${extras.join(", ")}` : extras.join(", ");
    }
  }

  return {
    ...parsed,
    partNumber: finalPn,
    partName,
    categoryName,
    subcategory: sub,
    unit,
    minimumQuantity: minQty,
    confidence,
    notes,
  };
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

export async function suggestPartFromImage(
  file: File,
  options: SuggestPartOptions = {},
): Promise<PartAiSuggestion> {
  const allowDbFallback = options.allowDbFallback ?? true;
  const mediaType = mediaTypeFromFile(file);
  if (!mediaType) {
    throw new Error("File must be JPG, PNG, or WebP");
  }

  const visionModelName = await currentVisionModel();

  // Resize and compress image before sending to AI to prevent OOM and reduce latency
  const originalBuffer = Buffer.from(await file.arrayBuffer());
  if (originalBuffer.length > MAX_AI_IMAGE_SIZE) {
    throw new Error("File must be 5MB or smaller");
  }
  const { buffer: resizedBuffer } = await normalizeImage(originalBuffer, {
    format: "jpeg",
    maxDimension: 1000,
    quality: 78,
  });

  // Try to read barcode/QR from image before calling AI
  let scannedBarcode: string | null = null;
  try {
    const { readBarcodesFromImageData } = await import("zxing-wasm/reader");
    const { buffer: rawPixels, width, height } = await normalizeImage(originalBuffer, {
      format: "raw",
      maxDimension: 1200,
    });
    const imageData = { data: new Uint8ClampedArray(rawPixels), width, height, colorSpace: "srgb" as const };
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

  const filenameHint = file.name
    ? `\nFILENAME HINT: "${file.name}". This is a WEAK hint only — the user may have renamed the file. If the filename suggests a model number, use it to GUIDE your OCR reading but NEVER override what the label actually says. If OCR and filename conflict, report the conflict in notes and trust OCR over filename.`
    : "";

  const prompt = [
    "You are a vision-first inventory assistant. Your primary job is to visually classify the spare part in the image.",
    "",
    "VISION-FIRST RULES:",
    "1. ALWAYS produce a valid JSON object. No markdown, no preamble.",
    "2. VISUAL CLASSIFICATION (do this first): Look at the part's shape, color, terminal count, mounting holes, and form factor. Classify into one of these types: Contactor, Relay, Breaker, Fuse, Bearing, Sensor, Solenoid Valve, Terminal Block, Pneumatic Fitting, Motor, Inverter, Switch, Power Supply, Cable, Connector, PLC, Timer, Push Button, Indicator Light, Cable Gland, Busbar, Transformer, Circuit Board, or other industrial part.",
    "3. LABEL READING (if visible): Read any printed label, nameplate, or marking. If you can read a brand name, model number, specs (voltage/current/size), use them. If text is blurry or absent, do NOT invent — classify from visual shape only.",
    "4. OCR CHARACTER VIGILANCE — these characters are easily confused in printed labels:",
    "   • 0 (zero) vs O (letter O) vs D",
    "   • 1 (one) vs I (letter I) vs L vs | (pipe)",
    "   • 2 vs Z",
    "   • 5 vs S",
    "   • 8 vs B vs 3",
    "   • C vs G",
    "   • W vs VV",
    "   • _ (underscore) vs - (dash) vs space",
    "   • . (dot) vs , (comma) in model numbers",
    "   Read each character deliberately. If ANY character is ambiguous, do NOT pick one silently — report it in uncertainPartNumberChars.",
    "5. OCR CONFIDENCE RULES (CRITICAL):",
    "   • Set partNumberConfidence to reflect YOUR certainty in reading the EXACT model# characters.",
    "   • If partNumberConfidence < 0.85 → set partNumber=\"\" (empty string) and list your best guess(es) in partNumberCandidates.",
    "   • If any character is blurry, faint, damaged, or ambiguous → partNumberConfidence MUST be < 0.85.",
    "   • If the label is clearly legible with every character sharp → partNumberConfidence can be 0.90-1.00.",
    "   • partNumberConfidence is NULL only when partNumber is empty.",
    "6. FIELD RULES:",
    "   - partNumber: ONLY from a clearly visible model/SKU printed on the part label or nameplate. Empty string '' if any doubt about ANY character. You may also use a barcode value if it appears to be a model number. NEVER invent or guess a part number from visual shape alone — the system will assign a provisional code if needed.",
    "   - partNumberCandidates: When partNumber is '' due to uncertainty, list 1-3 alternative readings here (e.g. ['3RN2010-1CW30','3RN1010-1CW00']). Empty [] if partNumber is confident or truly no model visible.",
    "   - partNumberConfidence: Set per rule 5 above. Be honest about character-level ambiguity.",
    "   - uncertainPartNumberChars: List specific character positions with doubts, e.g. ['char3: 0 or O','char7: blurry may be 1 or I'].",
    "   - partName: ALWAYS fill. If brand readable → 'Brand - Type'. If only type → 'Unknown Brand - Type'. Never leave empty.",
    "   - subcategory: ALWAYS fill with English type from step 2. Never leave empty.",
    "   - categoryName: ALWAYS fill with Thai category. Map: Contactor/Relay/Breaker/Fuse/Switch → 'อุปกรณ์ไฟฟ้า', Bearing → 'ตลับลูกปืน', Sensor → 'เซ็นเซอร์', Motor/Inverter → 'มอเตอร์', Solenoid Valve → 'วาล์ว', Pneumatic Fitting → 'อุปกรณ์นิวเมติกส์', Cable/Connector/Terminal Block → 'สายไฟ/คอนเนคเตอร์', Power Supply → 'แหล่งจ่ายไฟ', PLC/Timer → 'อุปกรณ์ควบคุม', else 'อะไหล่'.",
    "   - description: Include visual observations (color, pole count, terminal type, mounting style, size estimate) PLUS any label info. Format: [Brand or 'Unknown'] [Type] [Model if any], [Visual specs], [Standard if visible], typical application.",
    "   - confidence: Be honest about overall classification. 0.85-0.95=model# clearly visible on label. 0.70-0.85=brand/type visible but no model#. 0.55-0.75=visual shape match only, no readable text. 0.30-0.50=dark/blurry/partial view. 0.20=unusable image.",
    "   - notes: SHORT evidence tag per field. Format: 'visual: <what you see>, label: <what label says>, OCR: <readable text>, barcode: <scanned>'. MUST mention if any characters are uncertain/ambiguous/blurry. Under 200 chars.",
    "   - barcodeValue: ONLY if you can clearly read a barcode/QR number. null otherwise. NEVER invent.",
    "   - quantity: 1 (default).",
    "   - unit: 'pcs' for most, 'm' for cable, 'set' for kits.",
    "7. UNCERTAINTY: When unsure between similar types (e.g. Contactor vs Breaker), pick the most likely and note the alternative in notes.",
    filenameHint,
    scannedBarcode ? `\nBARCODE: "${scannedBarcode}" already scanned from image. Use this exact value for barcodeValue.` : "",
    `\nEXISTING CATEGORIES: ${categoryNames}`,
    "\nJSON SCHEMA:",
    JSON.stringify(suggestionJsonShape),
  ].join("\n");

  const aiContent: AiContentBlock[] = [
    { type: "text", text: prompt },
    {
      type: "image",
      imageBase64: resizedBuffer.toString("base64"),
      mediaType: "image/jpeg",
    },
  ];

  let result: Awaited<ReturnType<typeof callPartAi>> | null = null;
  let diagnostics: VisionDiagnostics | undefined;
  try {
    result = await callPartAi(aiContent, { maxTokens: 4096, temperature: 0, timeoutMs: 60_000 }, visionModelName);
    diagnostics = result.diagnostics;
  } catch (err) {
    const message = (err as Error).message;
    console.error("AI gateway error:", message);
    if (!allowDbFallback) {
      throw new Error(`AI gateway returned error: ${message}`);
    }
    console.warn("AI gateway failed, using image DB fallback:", message);
  }

  if (diagnostics) {
    console.log(
      `[AI Vision] model=${diagnostics.model} provider=${diagnostics.provider} ` +
      `images=${diagnostics.imageBlockCount} media=[${diagnostics.mediaTypes.join(",")}] ` +
      `mode=${diagnostics.requestMode} latency=${diagnostics.latencyMs}ms`,
    );
  }

  let parsed: z.infer<typeof aiSuggestionSchema>;
  if (result) {
    try {
      parsed = await parsePartSuggestion(result.text);
    } catch (error) {
      console.error(
        "AI suggestion parse failed, using image DB fallback:",
        error instanceof Error ? error.message : error,
      );
      if (!allowDbFallback) throw error;
      parsed = await fallbackSuggestionFromImage(originalBuffer, scannedBarcode);
    }
  } else {
    parsed = await fallbackSuggestionFromImage(originalBuffer, scannedBarcode);
  }

  // Apply post-parse default rules (brand/subcategory/minQty/partNumber hygiene)
  parsed = applyPostParseDefaults(parsed, scannedBarcode);

  // Log confidence and partNumber source (secret-safe)
  const pnSource = parsed.partNumber.startsWith("TMP-")
    ? "provisional"
    : scannedBarcode
      ? "scannedBarcode"
      : parsed.partNumber
        ? "AI-label"
        : "none";
  console.log(
    `[AI Vision] confidence=${parsed.confidence} ` +
    `partNumberSource=${pnSource} ` +
    `subcategory="${parsed.subcategory}" categoryName="${parsed.categoryName}"`,
  );
  const resolved = await resolveCategory(parsed.categoryName ?? "");

  const barcodeValue = scannedBarcode || parsed.barcodeValue?.trim() || generatePartBarcodeValue(parsed.partNumber ?? parsed.partName ?? "");

  return {
    ...parsed,
    barcodeValue,
    categoryId: resolved.categoryId ?? categoryId,
    matchedCategoryName: resolved.matchedCategoryName ?? matchedCategoryName,
    diagnostics,
  };
}

async function parsePartSuggestion(text: string) {
  try {
    return aiSuggestionSchema.parse(parseJsonObject(text));
  } catch (parseErr) {
    console.error("AI raw response text:", text.substring(0, 500));
    if (!text.trim()) throw parseErr;

    const repairPrompt = [
      "Convert the following AI output into one valid JSON object matching the schema below.",
      "Return JSON only — no markdown, no explanation.",
      "IMPORTANT: partNumber must be empty string '' unless a specific model/SKU is clearly named in the text. partName and subcategory must ALWAYS be filled (classify visually). categoryName must be a Thai category. confidence must reflect actual evidence level. barcodeValue must be null unless a real barcode number is present.",
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

async function fallbackSuggestionFromImage(
  buffer: Buffer,
  scannedBarcode: string | null,
): Promise<z.infer<typeof aiSuggestionSchema>> {
  try {
    const queryEmbedding = await embedImageWithMetadata(buffer, "query");
    const parts = await prisma.part.findMany({
      where: {
        isActive: true,
        imageEmbedding: { not: null },
        imageEmbeddingProvider: queryEmbedding.provider,
        imageEmbeddingModel: queryEmbedding.model,
      },
      select: {
        partNumber: true,
        partName: true,
        description: true,
        subcategory: true,
        unit: true,
        barcodeValue: true,
        imageEmbedding: true,
        category: { select: { name: true } },
      },
      take: 1000,
      orderBy: { updatedAt: "desc" },
    });

    const best = parts
      .map((part) => {
        const similarity = cosineSimilarity(
          queryEmbedding.vector,
          bytesToFloat32(part.imageEmbedding as Buffer),
        );
        return { part, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)[0];

    if (best && best.similarity >= 0.45) {
      return aiSuggestionSchema.parse({
        partNumber: "",
        partName: best.part.partName || "Unknown - Spare Part",
        description: best.part.description || "",
        categoryName: best.part.category?.name || "อะไหล่",
        subcategory: best.part.subcategory || "",
        location: "",
        quantity: 0,
        minimumQuantity: 0,
        unit: best.part.unit || "pcs",
        barcodeValue: scannedBarcode || null,
        confidence: Math.min(best.similarity, 0.65),
        notes: `AI อ่านรูปไม่สำเร็จ ระบบเติมข้อมูลตั้งต้นจากรูปอะไหล่ใน DB ที่คล้ายที่สุด (${best.part.partNumber}) กรุณาตรวจสอบก่อนบันทึก`,
      });
    }
  } catch (error) {
    console.error(
      "AI suggestion image fallback failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return aiSuggestionSchema.parse({
    partNumber: "",
    partName: "Unknown - Spare Part",
    description: "",
    categoryName: "อะไหล่",
    subcategory: "",
    location: "",
    quantity: 0,
    minimumQuantity: 0,
    unit: "pcs",
    barcodeValue: scannedBarcode,
    confidence: 0.2,
    notes:
      "AI อ่านรูปไม่สำเร็จ กรุณากรอกรหัส รุ่น และชื่ออะไหล่จากป้ายบนอุปกรณ์ก่อนบันทึก",
  });
}

