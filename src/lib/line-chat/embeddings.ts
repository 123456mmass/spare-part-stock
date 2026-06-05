// Text embedding generation for conversation memory
// Phase 1: ใช้ keyword-based scoring แทน vector embeddings เพื่อหลีกเลี่ยง model download ขนาดใหญ่
// จะ upgrade เป็น vector DB ใน Phase 2 เมื่อต้องการ semantic search ขั้นสูง

export type TextEmbedding = {
  text: string;
  tokens: string[];
  // สำหรับ Phase 1: ไม่มี vector ใช้ keyword matching แทน
};

const STOP_WORDS = new Set([
  // Thai
  "ที่", "ใน", "ของ", "และ", "หรือ", "คือ", "มี", "ได้", "ให้", "จะ", "แล้ว", "ด้วย",
  "ก็", "เลย", "นะ", "ครับ", "ค่ะ", "อ่ะ", "อะไร", "ไหน", "ยัง", "อยู่",
  "เป็น", "ไป", "มา", "มี", "ไม่", "ใช่", "ใช่ไหม", "นี่", "นั่น", "โน่น",
  // English
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "i", "you", "he", "she", "it", "we", "they", "what", "which", "who",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "as",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

export function embedText(text: string): TextEmbedding {
  return {
    text,
    tokens: tokenize(text),
  };
}

// คำนวณ similarity score ระหว่าง 2 embeddings (Phase 1: token overlap)
export function scoreRelevance(a: TextEmbedding, b: TextEmbedding): number {
  if (a.tokens.length === 0 || b.tokens.length === 0) return 0;
  const setA = new Set(a.tokens);
  const setB = new Set(b.tokens);
  let overlap = 0;
  for (const t of setA) {
    if (setB.has(t)) overlap++;
  }
  // Jaccard similarity
  const union = new Set([...a.tokens, ...b.tokens]).size;
  return overlap / union;
}

// ค้นหา messages ที่เกี่ยวข้องมากที่สุด
export function findRelevant(
  query: string,
  candidates: { id: string; content: string }[],
  topK = 5
): { id: string; content: string; score: number }[] {
  const queryEmb = embedText(query);
  const scored = candidates.map((c) => ({
    ...c,
    score: scoreRelevance(queryEmb, embedText(c.content)),
  }));
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
