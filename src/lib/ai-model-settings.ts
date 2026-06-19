import { prisma } from "./prisma";

export const AI_MODEL_SETTING_KEY = "LLM_GATEWAY_MODEL";
export const VISION_MODEL_SETTING_KEY = "SPARE_PART_AI_VISION_MODEL";

// Curated list of real gateway model ids (kept in sync with the 9router
// provider registry). Used as the dropdown fallback when the live
// /v1/models fetch fails.
//
// After migration from gateway-llm → 9router:
//   - umans/* models are served by the Umans Code OpenAI-compatible node
//     (prefix=umans, baseUrl=https://api.code.umans.ai/v1)
//   - cmc/* models are served by the built-in commandcode provider
//   - xiaomi-direct/* needs an API key added in the 9router dashboard
export const FALLBACK_AI_MODELS = [
  "umans/umans-kimi-k2.7",
  "umans/umans-flash",
  "umans/umans-glm-5.2",
  "umans/umans-coder",
  "cmc/deepseek/deepseek-v4-flash",
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

/** Env override for the vision model (highest priority when set). */
export function fallbackVisionModel(): string {
  return process.env.SPARE_PART_AI_VISION_MODEL || "";
}

/**
 * Resolve the configured vision model.
 * Priority: DB AppSetting (set via the AI settings page) → env override → "".
 * Returns "" when nothing is configured so callers can fall back to the
 * main model or the hard vision fallback.
 */
export async function getConfiguredVisionModel(): Promise<string> {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: VISION_MODEL_SETTING_KEY },
      select: { value: true },
    });
    return setting?.value || fallbackVisionModel();
  } catch (error) {
    console.error("Failed to load vision model setting:", error);
    return fallbackVisionModel();
  }
}

export async function setConfiguredVisionModel(model: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: VISION_MODEL_SETTING_KEY },
    create: {
      key: VISION_MODEL_SETTING_KEY,
      value: model,
      category: "ai",
    },
    update: {
      value: model,
      category: "ai",
    },
  });
}

// ── Model capability map ──────────────────────────────────────────

export type ModelCapabilities = {
  /** Model supports image/vision input */
  supportsVision: boolean;
  /** Model supports tool/function calling */
  supportsTools: boolean;
  /** Model has extended thinking/reasoning */
  hasThinking: boolean;
  /** Recommended max_tokens for tool-calling workflows */
  recommendedMaxTokens: number;
  /** Display name for UI */
  displayName: string;
};

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsVision: true,
  supportsTools: true,
  hasThinking: false,
  recommendedMaxTokens: 2000,
  displayName: "Unknown",
};

const MODEL_CAPABILITY_MAP: Record<string, ModelCapabilities> = {
  // Qwen (current default vision model)
  "qwen/qwen3.5-397b-a17b": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Qwen 3.5 397B",
  },
  // Umans models
  "umans/umans-kimi-k2.7": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Kimi K2.7",
  },
  "umans/umans-kimi-k2.6": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Kimi K2.6",
  },
  "umans/umans-glm-5.2": {
    supportsVision: false, // via-handoff, not native
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "GLM 5.2",
  },
  "umans/umans-glm-5.1": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "GLM 5.1",
  },
  "umans/umans-coder": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Umans Coder",
  },
  "umans/umans-flash": {
    supportsVision: false,
    supportsTools: false,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "Umans Flash (ไม่แนะนำ)",
  },
  // Xiaomi models
  "xiaomi-direct/mimo-v2.5-pro": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "MiMo V2.5 Pro",
  },
  "xiaomi-direct/mimo-v2.5": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "MiMo V2.5",
  },
  // Claude aliases
  "claude-commandcode-mimo-v2.5-pro": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "MiMo V2.5 Pro",
  },
  "claude-commandcode-mimo-v2.5": {
    supportsVision: true,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "MiMo V2.5",
  },
  // MiniMax
  "MiniMax/MiniMax-M2.7": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "MiniMax M2.7",
  },
  "MiniMax/MiniMax-M2.5": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "MiniMax M2.5",
  },
  // DeepSeek
  "claude-gateway-deepseek-v4-pro": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "DeepSeek V4 Pro",
  },
  "claude-gateway-deepseek-v4-flash": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "DeepSeek V4 Flash",
  },
  // CommandCode models (9router built-in, prefix=cmc)
  "cmc/deepseek/deepseek-v4-pro": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "DeepSeek V4 Pro (CommandCode)",
  },
  "cmc/deepseek/deepseek-v4-flash": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: false,
    recommendedMaxTokens: 1500,
    displayName: "DeepSeek V4 Flash (CommandCode)",
  },
  "cmc/moonshotai/Kimi-K2.6": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Kimi K2.6 (CommandCode)",
  },
  "cmc/zai-org/GLM-5.1": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "GLM 5.1 (CommandCode)",
  },
  "cmc/Qwen/Qwen3.6-Plus": {
    supportsVision: false,
    supportsTools: true,
    hasThinking: true,
    recommendedMaxTokens: 2000,
    displayName: "Qwen 3.6 Plus (CommandCode)",
  },
};

/**
 * Get capabilities for the given model ID.
 * Falls back to defaults for unknown models.
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITY_MAP[modelId] ?? {
    ...DEFAULT_CAPABILITIES,
    displayName: modelId,
  };
}

/**
 * Check if the currently configured model supports vision/image input.
 */
export async function currentModelSupportsVision(): Promise<boolean> {
  const modelId = await getConfiguredAiModel();
  return getModelCapabilities(modelId).supportsVision;
}

/**
 * Get recommended max_tokens for the currently configured model.
 */
export async function currentModelMaxTokens(): Promise<number> {
  const modelId = await getConfiguredAiModel();
  return getModelCapabilities(modelId).recommendedMaxTokens;
}
