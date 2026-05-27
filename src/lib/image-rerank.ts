import fs from "fs/promises";
import path from "path";
import { callPartAi, imageBlockForAi, parseJsonObject, type AiContentBlock } from "./ai-client";

export interface RerankCandidate {
  id: string;
  partNumber: string;
  partName: string;
  imageUrl: string;
  similarity: number;
}

export async function rerankByVision<T extends RerankCandidate>(
  queryBuffer: Buffer,
  candidates: T[],
): Promise<T[]> {
  if (candidates.length <= 1) return candidates;

  const candidateBuffers = await Promise.all(
    candidates.map(async (c) => {
      const filePath = path.join(process.cwd(), "public", c.imageUrl);
      return fs.readFile(filePath);
    }),
  );

  const queryBlock = await imageBlockForAi(queryBuffer);
  const candidateBlocks = await Promise.all(candidateBuffers.map((b) => imageBlockForAi(b)));

  const labelLines = candidates
    .map((c, i) => `${i + 1}. ${c.partName} (${c.partNumber})`)
    .join("\n");

  const prompt = [
    "You are matching a query photo of a spare part against candidate parts from inventory.",
    "The first image is the QUERY — what the user just photographed.",
    `The next ${candidates.length} images are CANDIDATES, numbered 1 through ${candidates.length}, in this order:`,
    labelLines,
    "",
    "Compare visual features: shape, size proportions, color, markings, connector type, terminal count, body style. Ignore lighting and background.",
    "Return only one JSON object, no markdown:",
    JSON.stringify({
      rankedIndices: "array of candidate numbers (1-based) ordered most-likely first to least-likely last. Include all candidates exactly once.",
      bestMatchConfidence: "0.0-1.0 — how confident the top match is correct",
      reasoning: "one short sentence explaining the top pick",
    }),
  ].join("\n");

  const content: AiContentBlock[] = [
    queryBlock,
    ...candidateBlocks,
    { type: "text", text: prompt },
  ];

  const result = await callPartAi(content, { maxTokens: 512, temperature: 0, timeoutMs: 30_000 });
  const parsed = parseJsonObject(result.text) as {
    rankedIndices?: unknown;
    bestMatchConfidence?: unknown;
  };

  if (!Array.isArray(parsed.rankedIndices)) {
    throw new Error("rerank: AI returned no rankedIndices");
  }

  const seen = new Set<number>();
  const reordered: T[] = [];
  for (const raw of parsed.rankedIndices) {
    const idx = Number(raw) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length && !seen.has(idx)) {
      seen.add(idx);
      reordered.push(candidates[idx]);
    }
  }
  for (let i = 0; i < candidates.length; i++) {
    if (!seen.has(i)) reordered.push(candidates[i]);
  }

  return reordered;
}
