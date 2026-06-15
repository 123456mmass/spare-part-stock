/**
 * Text-embedding vector similarity search for Part records.
 *
 * Complements the SQL `contains` search in line-chat/tools.ts by finding
 * semantic matches that keyword search would miss (e.g., "overload relay"
 * matching Thai "โอเวอร์โหลด").
 *
 * Uses the same CLIP text model that powers image embeddings, so text and
 * image queries share the same vector space.
 */

import { prisma } from "@/lib/prisma";
import { embedText, cosineSimilarity, bytesToFloat32 } from "@/lib/embeddings";

export type TextSearchMatch = {
  id: string;
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  location: string | null;
  plant: string | null;
  categoryName: string | null;
  buildingName: string | null;
  similarity: number;
};

export type TextSearchOptions = {
  /** Minimum cosine similarity threshold (default: 0.45 for CLIP text) */
  minSimilarity?: number;
  /** Maximum results to return (default: 10) */
  limit?: number;
  /** Optional plant filter */
  plant?: string | null;
  /** Optional building ID filter */
  buildingId?: string | null;
  /** Optional building name filter */
  buildingName?: string | null;
};

/**
 * Search parts by text-embedding vector similarity.
 *
 * Returns parts whose textEmbedding is closest to the query text's embedding,
 * filtered by an optional minimum similarity threshold.
 *
 * Fallback: returns empty array if no parts have textEmbedding or if the
 * embedding model fails.
 */
export async function searchPartsByTextEmbedding(
  queryText: string,
  options: TextSearchOptions = {},
): Promise<TextSearchMatch[]> {
  const {
    minSimilarity = 0.45,
    limit = 10,
    plant,
    buildingId,
    buildingName,
  } = options;

  if (!queryText.trim()) return [];

  // Embed the query text
  let queryVector: Float32Array;
  try {
    queryVector = await embedText(queryText);
  } catch (error) {
    console.error("Text embedding for search failed:", error);
    return [];
  }

  // Build where clause for filtering
  const andConditions: Record<string, unknown>[] = [
    { isActive: true },
    { textEmbedding: { not: null } },
  ];

  if (plant) {
    andConditions.push({ plant: { contains: plant } });
  }
  if (buildingId) {
    andConditions.push({ buildingId });
  } else if (buildingName) {
    andConditions.push({ building: { name: { contains: buildingName } } });
  }

  // Load candidate parts with textEmbedding
  const parts = await prisma.part.findMany({
    where: { AND: andConditions },
    select: {
      id: true,
      partNumber: true,
      partName: true,
      quantity: true,
      minimumQuantity: true,
      unit: true,
      location: true,
      plant: true,
      textEmbedding: true,
      category: { select: { name: true } },
      building: { select: { name: true } },
    },
    take: 2000,
    orderBy: { updatedAt: "desc" },
  });

  if (parts.length === 0) return [];

  // Compute similarity for each part
  const matches: TextSearchMatch[] = [];
  for (const part of parts) {
    if (!part.textEmbedding) continue;
    try {
      const partVector = bytesToFloat32(part.textEmbedding as Buffer);
      const similarity = cosineSimilarity(queryVector, partVector);
      if (similarity >= minSimilarity) {
        matches.push({
          id: part.id,
          partNumber: part.partNumber,
          partName: part.partName,
          quantity: part.quantity,
          minimumQuantity: part.minimumQuantity,
          unit: part.unit,
          location: part.location,
          plant: part.plant,
          categoryName: part.category?.name ?? null,
          buildingName: part.building?.name ?? null,
          similarity,
        });
      }
    } catch {
      // Skip parts with corrupted embeddings
    }
  }

  // Sort by similarity descending, then by quantity descending
  matches.sort((a, b) => b.similarity - a.similarity || b.quantity - a.quantity);

  return matches.slice(0, limit);
}

/**
 * Check if any parts in the database have textEmbedding set.
 * Used by the hybrid search to decide whether to attempt vector search.
 */
export async function hasTextEmbeddings(): Promise<boolean> {
  const count = await prisma.part.count({
    where: { isActive: true, textEmbedding: { not: null } },
    take: 1,
  });
  return count > 0;
}
