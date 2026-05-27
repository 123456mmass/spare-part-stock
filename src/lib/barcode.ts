import crypto from "crypto";
import bwipjs from "bwip-js";

export function generatePartBarcodeValue(partNumber: string) {
  const normalized = partNumber.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const prefix = normalized.slice(0, 8) || "PART";
  const unique = Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${unique}`;
}

export function generatePartNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `P-${ts}-${rand}`;
}

export async function generateBarcodePng(value: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text: value,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
  });
}
