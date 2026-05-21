import ExcelJS from "exceljs";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "./prisma";
import { generateQRCode } from "./qrcode";
import {
  extractImagesFromWorkbook,
  processAndSaveImage,
  preflightImportRows,
  applyImportedRows,
} from "./excel";
import { generatePartBarcodeValue } from "./barcode";
import { validateImportRows, type RawImportRow } from "./import-validation";

const MAX_AI_IMPORT_ROWS = 100; // Reduced from 300 to prevent OOM / API exhaustion

const aiPartSchema = z.object({
  partNumber: z.string().trim().min(1),
  partName: z.string().trim().min(1),
  description: z.string().trim().nullable().optional().transform(v => v || ""),
  category: z.string().trim().nullable().optional().transform(v => v || ""),
  subcategory: z.string().trim().nullable().optional().transform(v => v || ""),
  location: z.string().trim().nullable().optional().transform(v => v || ""),
  quantity: z.coerce.number().int().min(0).nullable().optional().transform(v => v || 0),
  minimumQuantity: z.coerce.number().int().min(0).nullable().optional().transform(v => v || 0),
  unit: z.string().trim().nullable().optional().transform(v => v || "pcs"),
  barcodeValue: z.string().trim().nullable().optional().default(null),
});

const aiImportSchema = z.object({
  parts: z.array(aiPartSchema).max(MAX_AI_IMPORT_ROWS),
});

type AiPart = z.infer<typeof aiPartSchema> & { rowNum?: number };

export interface AiImportResult {
  success: boolean;
  imported: number;
  updated: number;
  errors: string[];
  imagesExtracted: number;
  aiUsed: boolean;
}

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

async function imageBlockForGateway(buffer: Buffer) {
  const normalized = await sharp(buffer)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: normalized.toString("base64"),
    },
  };
}

function cellText(row: ExcelJS.Row, col: number | undefined) {
  if (!col) return "";
  return row.getCell(col).text?.toString().trim() || "";
}

function findColumn(headers: Record<string, number>, names: string[]) {
  for (const name of names) {
    const col = headers[name.toLowerCase()];
    if (col) return col;
  }
  return undefined;
}

async function parseWorkbookRows(fileBuffer: ArrayBuffer | Buffer) {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(fileBuffer as any);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("No first worksheet found");

  const headerRow = worksheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const value = cell.text?.toString().trim().toLowerCase();
    if (value) headers[value] = colNumber;
  });

  const partNumberCol = findColumn(headers, ["part number", "part no.", "part no", "item code", "sku"]);
  const partNameCol = findColumn(headers, ["part name", "description", "desc", "item name", "name"]);
  const quantityCol = findColumn(headers, ["quantity", "qty", "stock", "count"]);
  const categoryCol = findColumn(headers, ["category", "type", "group"]);
  const locationCol = findColumn(headers, ["location", "storage", "bin"]);
  const unitCol = findColumn(headers, ["unit", "uom", "measure"]);
  const barcodeCol = findColumn(headers, ["barcode", "barcodevalue"]);

  const rows: AiPart[] = [];
  const rowCount = Math.min(worksheet.actualRowCount || worksheet.rowCount || 1, MAX_AI_IMPORT_ROWS + 1);

  for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const values: string[] = [];
    for (let col = 1; col <= Math.min(worksheet.actualColumnCount || 12, 12); col++) {
      values.push(cellText(row, col));
    }

    const fallbackPartNumber = partNumberCol
      ? cellText(row, partNumberCol)
      : values.find(Boolean) || "";
    const fallbackName = partNameCol
      ? cellText(row, partNameCol) || fallbackPartNumber
      : fallbackPartNumber;
    if (!fallbackPartNumber || !fallbackName) continue;

    rows.push({
      rowNum,
      partNumber: fallbackPartNumber,
      partName: fallbackName,
      description: fallbackName,
      category: cellText(row, categoryCol),
      subcategory: "",
      location: cellText(row, locationCol),
      quantity: Number.parseInt(cellText(row, quantityCol) || "0", 10) || 0,
      minimumQuantity: 0,
      unit: cellText(row, unitCol) || "pcs",
      barcodeValue: cellText(row, barcodeCol) || null,
    });
  }

  return { workbook, rows };
}

async function enrichRowBatchWithAi(
  rows: AiPart[],
  categories: { name: string }[],
  imageMap: Map<number, Buffer>
) {
  if (rows.length === 0) return { rows, aiUsed: false };
  const prompt = [
    "You are an expert industrial spare-part inventory assistant with deep knowledge of brands, standards, and applications.",
    "Return only JSON with a parts array.",
    "IMPORTANT: If multiple rows refer to the same physical part (same or very similar partNumber/name), merge them into ONE entry — sum their quantities.",
    "Do not invent unknown serial numbers. Use partNumber from input if present.",
    "For partName: format as 'Brand - Part Type' in English (e.g. 'Schneider - Contactor', 'Fanox - Current Transformer', 'Weidmuller - Terminal Block'). Use your knowledge to identify brand from part number or image.",
    "For description: include brand, type, model, rated specs (voltage/current/size), standard (IEC/DIN/JIS), and typical application in Thai. e.g. 'Schneider Electric TeSys D, LC1D09, 9A 3-pole, 220VAC coil, IEC 60947, ใช้ควบคุมมอเตอร์/ปั๊ม'",
    "For category: ALWAYS provide a Thai category name (e.g. อุปกรณ์ไฟฟ้า, เซ็นเซอร์, วาล์ว, มอเตอร์). NEVER leave empty.",
    "For subcategory: ALWAYS provide specific English part type (e.g. Contactor, Breaker, Fuse, Terminal Block, Current Transformer, Panel Meter, Relay).",
    "Important: barcodeValue is a machine-readable barcode/QR number visible on the part/label. Use null if not visible.",
    `Existing categories: ${categories.map((category) => category.name).join(", ") || "none"}`,
    "Each output part must have: partNumber, partName, description, category, subcategory, location, quantity, minimumQuantity, unit, barcodeValue.",
    "Rows:",
    JSON.stringify(rows.map(({ rowNum, ...row }) => ({ rowNum, hasImage: rowNum ? imageMap.has(rowNum) : false, ...row }))),
  ].join("\n");

  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const row of rows) {
    if (!row.rowNum || !imageMap.has(row.rowNum)) continue;
    content.push({ type: "text", text: `Image for row ${row.rowNum}, partNumber ${row.partNumber}:` });
    content.push(await imageBlockForGateway(imageMap.get(row.rowNum)!));
  }

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
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: gatewayModel(),
      max_tokens: 6000,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) throw new Error(`AI gateway returned ${response.status}`);
  const text = extractTextFromAnthropic(await response.json());
  const parsed = aiImportSchema.parse(parseJsonObject(text));
  const enriched = parsed.parts.map((part, index) => ({ ...part, rowNum: rows[index]?.rowNum ?? index + 2 }));
  return { rows: enriched, aiUsed: true };
}

async function enrichRowsWithAi(rows: AiPart[], imageMap: Map<number, Buffer>) {
  if (rows.length === 0) return { rows, aiUsed: false };

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const batchSize = 8;
  const enrichedRows: AiPart[] = [];
  const errors: string[] = [];
  let aiUsed = false;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    try {
      const enriched = await enrichRowBatchWithAi(batch, categories, imageMap);
      enrichedRows.push(...enriched.rows);
      aiUsed = true;
    } catch (err) {
      console.error("AI Enrichment Error:", err);
      enrichedRows.push(...batch);
      errors.push(
        `AI batch rows ${batch[0]?.rowNum ?? "?"}-${batch.at(-1)?.rowNum ?? "?"} fallback`
      );
    }
  }

  return { rows: enrichedRows, aiUsed, errors };
}

export async function importPartsFromExcelWithAi(
  fileBuffer: ArrayBuffer | Buffer,
  userId: string
): Promise<AiImportResult> {
  const result: AiImportResult = {
    success: false,
    imported: 0,
    updated: 0,
    errors: [],
    imagesExtracted: 0,
    aiUsed: false,
  };

  try {
    const { workbook, rows: parsedRows } = await parseWorkbookRows(fileBuffer);
    const extractedImages = await extractImagesFromWorkbook(workbook);
    result.imagesExtracted = extractedImages.length;

    const imageMap = new Map<number, Buffer>();
    for (const img of extractedImages) imageMap.set(img.rowIndex, img.buffer);

    let rows = parsedRows;
    try {
      const enriched = await enrichRowsWithAi(parsedRows, imageMap);
      rows = enriched.rows;
      result.aiUsed = enriched.aiUsed;
      result.errors.push(...(enriched.errors ?? []));
    } catch (err) {
      console.error("AI Enrichment Error:", err);
      result.errors.push("AI processing unavailable, using raw Excel data");
    }

    const validated = validateImportRows(
      rows.map<RawImportRow>((row) => ({
        rowNum: row.rowNum ?? 0,
        partNumber: row.partNumber,
        partName: row.partName,
        description: row.description || undefined,
        categoryName: row.category || undefined,
        subcategory: row.subcategory || undefined,
        location: row.location || undefined,
        quantity: row.quantity,
        minimumQuantity: row.minimumQuantity,
        unit: row.unit || "pcs",
        barcodeValue: row.barcodeValue || undefined,
      })),
      generatePartBarcodeValue
    );
    result.errors.push(...validated.errors);

    const preflight = await preflightImportRows(validated.rows, result.errors);
    if (result.errors.length > 0 || !preflight) {
      return result;
    }

    const applied = await applyImportedRows({
      rows: validated.rows,
      userId,
      existingPartsByPartNumber: preflight.existingPartsByPartNumber,
    });

    result.imported = applied.imported;
    result.updated = applied.updated;

    // Process images and QR codes after transaction commits
    for (const img of applied.imageUpdates) {
      if (!imageMap.has(img.rowNum)) continue;
      const imageBuffer = imageMap.get(img.rowNum);
      if (imageBuffer) {
        const imageUrl = await processAndSaveImage(imageBuffer, img.partNumber);
        if (imageUrl) {
          await prisma.part.update({ where: { id: img.partId }, data: { imageUrl } });
        }
      }
    }

    for (const qr of applied.qrUpdates) {
      const qrCodeUrl = await generateQRCode(qr.partId, qr.partNumber);
      await prisma.part.update({ where: { id: qr.partId }, data: { qrCodeUrl } });
    }

    result.success = result.errors.length === 0 || result.imported + result.updated > 0;
  } catch (err) {
      console.error("AI Enrichment Error:", err);
    result.errors.push("AI Excel import failed");
  }

  return result;
}
