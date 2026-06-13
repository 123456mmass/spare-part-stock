/**
 * LINE group/room mention detection and text clean-up helpers.
 *
 * These functions are kept separate from the webhook route so they can be
 * unit-tested without pulling in Next.js or Prisma dependencies.
 */

export type MentionContext = {
  message?: {
    text?: string;
    mention?: {
      mentionees?: Array<{
        index?: number;
        length?: number;
        userId?: string;
        isSelf?: boolean;
      }>;
    };
  } | null;
};

export function isBotMentioned(
  context: MentionContext | null | undefined,
  rawText: string,
  botMentionText: string,
  botUserId?: string,
): boolean {
  const mentionees = context?.message?.mention?.mentionees;
  if (mentionees && mentionees.length > 0) {
    return mentionees.some(
      (m) => m.isSelf === true || (botUserId && m.userId === botUserId),
    );
  }
  return rawText.includes(botMentionText);
}

export function stripMentionText(
  rawText: string,
  context: MentionContext | null | undefined,
  botMentionText: string,
): string {
  const mentionees = context?.message?.mention?.mentionees;
  if (mentionees && mentionees.length > 0) {
    const validMentionees = mentionees.filter(
      (m): m is { index: number; length: number } =>
        typeof m.index === "number" && typeof m.length === "number",
    );
    const sorted = [...validMentionees].sort((a, b) => b.index - a.index);
    let result = rawText;
    for (const m of sorted) {
      if (m.index >= 0 && m.index + m.length <= result.length) {
        result = result.slice(0, m.index) + result.slice(m.index + m.length);
      }
    }
    return result.replace(/\s+/g, " ").trim();
  }

  return rawText
    .replace(new RegExp(botMentionText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
    .replace(/\s+/g, " ")
    .trim();
}

export const EXPLICIT_WEB_SEARCH_PATTERNS = [
  /ค้นเว็บ/i,
  /หาในเน็ต/i,
  /search internet/i,
  /ดูสเปคจากเว็บ/i,
  /รุ่นนี้คืออะไร/i,
];

export function isExplicitWebSearch(text: string): boolean {
  return EXPLICIT_WEB_SEARCH_PATTERNS.some((pattern) => pattern.test(text));
}
