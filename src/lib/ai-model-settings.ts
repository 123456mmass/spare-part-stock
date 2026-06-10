import { prisma } from "./prisma";

export const AI_MODEL_SETTING_KEY = "LLM_GATEWAY_MODEL";

export const FALLBACK_AI_MODELS = [
  "mimo-v2.5-pro",
  "sonnet-4.6",
  "kimi-k2.6",
  "kimik2.6",
  "mistral-agent",
];

export function fallbackAiModel(): string {
  return (
    process.env.SPARE_PART_AI_MODEL ||
    process.env.LLM_GATEWAY_MODEL ||
    FALLBACK_AI_MODELS[0]
  );
}

export async function getConfiguredAiModel(): Promise<string> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: AI_MODEL_SETTING_KEY },
      select: { value: true },
    });
    return setting?.value || fallbackAiModel();
  } catch (error) {
    console.error("Failed to load AI model setting:", error);
    return fallbackAiModel();
  }
}

export async function setConfiguredAiModel(model: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: AI_MODEL_SETTING_KEY },
    create: {
      key: AI_MODEL_SETTING_KEY,
      value: model,
      category: "ai",
    },
    update: {
      value: model,
      category: "ai",
    },
  });
}
