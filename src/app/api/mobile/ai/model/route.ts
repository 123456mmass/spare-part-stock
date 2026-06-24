import { NextResponse } from "next/server";
import { AuthError, requireRoleFromRequest } from "@/lib/auth";
import { gatewayBaseUrl, gatewayKey } from "@/lib/ai-client";
import {
  FALLBACK_AI_MODELS,
  getConfiguredAiModel,
  getConfiguredVisionModel,
  setConfiguredAiModel,
  setConfiguredVisionModel,
  getModelCapabilities,
} from "@/lib/ai-model-settings";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

async function getAvailableModels(
  baseUrl: string,
  apiKey: string,
  current: string[] = [],
): Promise<string[]> {
  const candidates = Array.from(
    new Set([...FALLBACK_AI_MODELS, ...current].filter(Boolean)),
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

export const GET = withCors(async (request: Request) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 },
      );
    }
    console.error("Mobile AI model fetch error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
      { status: 500 },
    );
  }
});

export const PUT = withCors(async (request: Request) => {
  try {
    await requireRoleFromRequest(request, ["ADMIN"]);

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

    if (model && typeof model === "string") {
      if (!knownModels.has(model)) knownModels.add(model);
      await setConfiguredAiModel(model);
      savedModel = model;
    }

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
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Forbidden" ? 403 : 401 },
      );
    }
    console.error("Mobile AI model update error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการบันทึก" },
      { status: 500 },
    );
  }
});
