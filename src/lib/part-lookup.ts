import { prisma } from "./prisma";

export async function resolvePartFromCode(code: string) {
  const decoded = decodeURIComponent(code).trim();

  // 1. Try full URL parsing (handles any host/path combo)
  try {
    const url = new URL(decoded);
    const urlPathMatch = url.pathname.match(/\/parts\/([a-z0-9]+)/i);
    if (urlPathMatch) {
      const part = await prisma.part.findFirst({
        where: { id: urlPathMatch[1], isActive: true },
        include: { category: true },
      });
      if (part) return part;
    }
  } catch {
    // Not a valid URL, continue
  }

  // 2. Raw path pattern: /parts/[id] or parts/[id] (with or without leading slash)
  const pathMatch = decoded.match(/\/?parts\/([a-z0-9]+)/i);
  if (pathMatch) {
    const part = await prisma.part.findFirst({
      where: { id: pathMatch[1], isActive: true },
      include: { category: true },
    });
    if (part) return part;
  }

  // 3. barcodeValue match (only active parts)
  const byBarcode = await prisma.part.findFirst({
    where: { barcodeValue: decoded, isActive: true },
    include: { category: true },
  });
  if (byBarcode) return byBarcode;

  // 4. Direct partNumber match (only active parts)
  const part = await prisma.part.findFirst({
    where: { partNumber: decoded, isActive: true },
    include: { category: true },
  });
  if (part) return part;

  return null;
}
