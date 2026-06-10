import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatewayBaseUrl, gatewayKey, gatewayModel } from "@/lib/ai-client";

// Hardcoded fallback models (from gateway provider registry)
const FALLBACK_MODELS = [
  "mistral-agent",
];

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

    const currentModel = gatewayModel();
    const baseUrl = gatewayBaseUrl();
    const apiKey = gatewayKey();
    const availableModels = await getAvailableModels(baseUrl, apiKey);

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

    if (!availableModels.includes(model)) {
      return NextResponse.json(
        { error: `Model "${model}" ไม่พบในรายการที่รองรับ` },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gateway API key not configured" },
        { status: 500 }
      );
    }

    // Update via gateway settings API
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        return NextResponse.json(
          { error: errorData?.detail || "Failed to update gateway settings" },
          { status: response.status }
        );
      }

      return NextResponse.json({
        success: true,
        model,
        message: `เปลี่ยน AI Model เป็น ${model} สำเร็จ`,
      });
    } catch (error) {
      console.error("Gateway settings update failed:", error);
      return NextResponse.json(
        { error: "ไม่สามารถเชื่อมต่อกับ Gateway ได้" },
        { status: 502 }
      );
    }
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
