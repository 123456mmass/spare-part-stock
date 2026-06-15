/**
 * Helpers for generating and storing text embeddings for Part records.
 *
 * Text embeddings are stored in Part.textEmbedding. The embedding provider
 * (CLIP local or Voyage API) is determined by IMAGE_EMBEDDING_PROVIDER /
 * VOYAGE_API_KEY env vars — same as image embeddings.
 *
 * Note: Voyage text embeddings and CLIP image embeddings live in DIFFERENT
 * vector spaces, so text queries search against textEmbedding and image
 * queries search against imageEmbedding independently.
 */

import { prisma } from "@/lib/prisma";
import { embedText, float32ToBytes } from "@/lib/embeddings";

function buildPartText(part: {
  partNumber: string;
  partName: string;
  description?: string | null;
  subcategory?: string | null;
  location?: string | null;
  plant?: string | null;
  category?: { name?: string | null } | null;
  building?: { name?: string | null } | null;
}): string {
  const parts = [
    part.partNumber,
    part.partName,
    part.subcategory || null,
    part.category?.name || null,
    part.description || null,
    part.building?.name || null,
    part.location || null,
    part.plant || null,
  ];
  return parts.filter(Boolean).join(" | ");
}

/**
 * Regenerate and store the text embedding for a single part by ID.
 */
export async function regeneratePartTextEmbedding(partId: string): Promise<void> {
  const part = await prisma.part.findUnique({
    where: { id: partId },
    include: {
      category: { select: { name: true } },
      building: { select: { name: true } },
    },
  });
  if (!part || !part.isActive) return;

  const text = buildPartText(part);
  try {
    const vector = await embedText(text, "document");
    await prisma.part.update({
      where: { id: partId },
      data: {
        textEmbedding: Buffer.from(float32ToBytes(vector)),
      },
    });
  } catch (error) {
    console.error(`Failed to generate text embedding for part ${partId}:`, error);
  }
}

/**
 * Build a part-text string from the data typically available when a part is
 * created or updated. Useful when the caller already has the related fields.
 */
export function buildPartTextFromFields(fields: {
  partNumber: string;
  partName: string;
  description?: string | null;
  subcategory?: string | null;
  location?: string | null;
  plant?: string | null;
  categoryName?: string | null;
  buildingName?: string | null;
}): string {
  return buildPartText({
    partNumber: fields.partNumber,
    partName: fields.partName,
    description: fields.description,
    subcategory: fields.subcategory,
    location: fields.location,
    plant: fields.plant,
    category: fields.categoryName ? { name: fields.categoryName } : null,
    building: fields.buildingName ? { name: fields.buildingName } : null,
  });
}
