import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatewayBaseUrl, gatewayKey } from "@/lib/ai-client";
import {
  FALLBACK_AI_MODELS,
  getConfiguredAiModel,
  getConfiguredVisionModel,
  setConfiguredAiModel,
  setConfiguredVisionModel,
  getModelCapabilities,
} from "@/lib/ai-model-settings";

/**
 * Curated real gateway model ids (kept in sync with the gateway provider
 * registry). Used as the dropdown fallback when the live /v1/models fetch
 * fails, and as the base set the dropdown is filtered down from.
 */
const FALLBACK_MODELS = FALLBACK_AI_MODELS;

/**
 * Fetch the live model list from the gateway's OpenAI-compatible
 * /v1/models endpoint (works with the spare-part-stock user API key, unlike
 * /admin/providers which needs the gateway admin key). Returns the curated
 * candidates that actually exist on the gateway, always keeping any current
 * selection so the user never loses their active model.
 */
async function getAvailableModels(
  baseUrl: string,
  apiKey: string,
  current: string[] = [],
): Promise<string[]> {
  const candidates = Array.from(
    new Set([...FALLBACK_MODELS, ...current].filter(Boolean)),
  );
  if (!apiKey) return candidates;

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return candidates;

    const data = await response.json();
    const ids = new Set<string>(
      (data.data ?? [])
        .map((m: { id?: string }) => m.id)
        .filter((id: unknown): id is string => typeof id === "string"),
    );
    if (ids.size === 0) return candidates;

    // Keep curated candidates that exist on the gateway, plus always keep
    // the current selection so it stays visible/selectable.
    const available = candidates.filter(
      (c) => ids.has(c) || current.includes(c),
    );
    return available.length > 0 ? available : candidates;
  } catch {
    return candidates;
  }
}

function buildCapabilities(models: string[]) {
  const acc: Record<
    string,
    {
      displayName: string;
      supportsVision: boolean;
      supportsTools: boolean;
      hasThinking: boolean;
    }
  > = {};
  for (const model of models) {
    const caps = getModelCapabilities(model);
    acc[model] = {
      displayName: caps.displayName,
      supportsVision: caps.supportsVision,
      supportsTools: caps.supportsTools,
      hasThinking: caps.hasThinking,
    };
  }
  return acc;
}

// GET /api/admin/ai-model - ดึง current model + vision model + available models
export async function GET() {
  try {
    await requireAuth();
    await requireRole(["ADMIN"]);

    const currentModel = await getConfiguredAiModel();
    const currentVisionModel = await getConfiguredVisionModel();
    const baseUrl = gatewayBaseUrl();
    const apiKey = gatewayKey();
    const availableModels = await getAvailableModels(baseUrl, apiKey, [
      currentModel,
      currentVisionModel,
    ]);

    const currentCapabilities = getModelCapabilities(currentModel);
    const currentVisionCapabilities = getModelCapabilities(
      currentVisionModel || currentModel,
    );

    return NextResponse.json({
      currentModel,
      currentVisionModel,
      availableModels,
      currentCapabilities: {
        displayName: currentCapabilities.displayName,
        supportsVision: currentCapabilities.supportsVision,
        supportsTools: currentCapabilities.supportsTools,
        hasThinking: currentCapabilities.hasThinking,
        recommendedMaxTokens: currentCapabilities.recommendedMaxTokens,
      },
      currentVisionCapabilities: {
        displayName: currentVisionCapabilities.displayName,
        supportsVision: currentVisionCapabilities.supportsVision,
        supportsTools: currentVisionCapabilities.supportsTools,
        hasThinking: currentVisionCapabilities.hasThinking,
        recommendedMaxTokens: currentVisionCapabilities.recommendedMaxTokens,
      },
      capabilities: buildCapabilities(availableModels),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching AI model settings:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 },
    );
  }
}

// PUT /api/admin/ai-model - เปลี่ยน model และ/หรือ vision model
export async function PUT(request: Request) {
  try {
    await requireAuth();
    await requireRole(["ADMIN"]);

    const body = await request.json();
    const { model, visionModel } = body as {
      model?: string;
      visionModel?: string;
    };

    if (!model && !visionModel) {
      return NextResponse.json(
        { error: "กรุณาระบุ model หรือ visionModel" },
        { status: 400 },
      );
    }

    const baseUrl = gatewayBaseUrl();
    const apiKey = gatewayKey();
    const currentMain = await getConfiguredAiModel();
    const currentVision = await getConfiguredVisionModel();
    const availableModels = await getAvailableModels(baseUrl, apiKey, [
      currentMain,
      currentVision,
      model,
      visionModel,
    ].filter((m): m is string => Boolean(m)));
    const knownModels = new Set(availableModels);

    let savedModel: string | undefined;
    let savedVisionModel: string | undefined;

    // Main model — stored locally (spare-part-stock sends the model id in
    // every AI request, so the gateway does not need a stored default).
    if (model && typeof model === "string") {
      if (!knownModels.has(model)) knownModels.add(model);
      await setConfiguredAiModel(model);
      savedModel = model;
    }

    // Vision model (stored locally only — controls image analysis).
    if (visionModel && typeof visionModel === "string") {
      if (!knownModels.has(visionModel)) knownModels.add(visionModel);
      await setConfiguredVisionModel(visionModel);
      savedVisionModel = visionModel;
    }

    const messages: string[] = [];
    if (savedModel) messages.push(`AI Model เป็น ${savedModel}`);
    if (savedVisionModel)
      messages.push(`Vision Model เป็น ${savedVisionModel}`);

    return NextResponse.json({
      success: true,
      model: savedModel ?? currentMain,
      visionModel: savedVisionModel ?? currentVision,
      availableModels: [...knownModels],
      message: `เปลี่ยน ${messages.join(" และ ")} สำเร็จ`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating AI model:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึก" },
      { status: 500 },
    );
  }
}
