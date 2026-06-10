import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatewayBaseUrl, gatewayKey } from "@/lib/ai-client";
import {
  FALLBACK_AI_MODELS,
  getConfiguredAiModel,
  setConfiguredAiModel,
} from "@/lib/ai-model-settings";

// Hardcoded fallback models (from gateway provider registry)
const FALLBACK_MODELS = FALLBACK_AI_MODELS;

async function getAvailableModels(baseUrl: string, apiKey: string): Promise<string[]> {
  if (!apiKey) return FALLBACK_MODELS;

  try {
    const response = await fetch(`${baseUrl}/admin/providers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return FALLBACK_MODELS;

    const data = await response.json();
    const models =
      data.configs
        ?.map((c: { model_id?: string }) => c.model_id)
        .filter(Boolean) || [];

    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

// GET /api/admin/ai-model - ดึง current model + available models
export async function GET() {
  try {
    await requireAuth();
    await requireRole(["ADMIN"]);

    const currentModel = await getConfiguredAiModel();
    const baseUrl = gatewayBaseUrl();
    const apiKey = gatewayKey();
    const availableModels = Array.from(
      new Set([currentModel, ...(await getAvailableModels(baseUrl, apiKey))].filter(Boolean)),
    );

    return NextResponse.json({
      currentModel,
      availableModels,
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
      { status: 500 }
    );
  }
}

// PUT /api/admin/ai-model - เปลี่ยน model
export async function PUT(request: Request) {
  try {
    await requireAuth();
    await requireRole(["ADMIN"]);

    const body = await request.json();
    const { model } = body;

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { error: "กรุณาเลือก model" },
        { status: 400 }
      );
    }

    const baseUrl = gatewayBaseUrl();
    const apiKey = gatewayKey();
    const availableModels = await getAvailableModels(baseUrl, apiKey);
    const knownModels = new Set([...availableModels, ...FALLBACK_MODELS]);
    if (!knownModels.has(model)) knownModels.add(model);

    await setConfiguredAiModel(model);

    let gatewaySynced = false;
    let gatewayWarning: string | undefined;
    try {
      const response = await fetch(`${baseUrl}/admin/settings/LLM_GATEWAY_MODEL`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          value: model,
          category: "ai",
          description: "Current AI model for spare-part-stock",
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        gatewaySynced = true;
      } else {
        const errorData = await response.json().catch(() => null);
        gatewayWarning = errorData?.detail || `Gateway settings returned ${response.status}`;
      }
    } catch (error) {
      console.error("Gateway settings update failed:", error);
      gatewayWarning = "ไม่สามารถ sync gateway admin setting ได้ แต่ระบบนี้บันทึกโมเดลแล้ว";
    }

    return NextResponse.json({
      success: true,
      model,
      availableModels: [...knownModels],
      gatewaySynced,
      gatewayWarning,
      message: `เปลี่ยน AI Model เป็น ${model} สำเร็จ`,
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
      { status: 500 }
    );
  }
}
