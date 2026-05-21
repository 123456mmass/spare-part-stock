import crypto from "crypto";
import bwipjs from "bwip-js";

export function generatePartBarcodeValue(partNumber: string) {
  const normalized = partNumber.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const hash = crypto.createHash("sha1").update(partNumber).digest("hex").slice(0, 8).toUpperCase();
  const prefix = normalized.slice(0, 10) || "PART";
  return `${prefix}-${hash}`;
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
