import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { gatewayBaseUrl, gatewayKey } from "@/lib/ai-client";
import { getConfiguredAiModel } from "@/lib/ai-model-settings";

// POST /api/admin/ai-model/test - ทดสอบ AI model
export async function POST(request: Request) {
  try {
    await requireAuth();
    await requireRole(["ADMIN"]);

    const body = await request.json();
    const { prompt, model } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "กรุณากรอก prompt" },
        { status: 400 }
      );
    }

    const useModel = model || (await getConfiguredAiModel());
    const startTime = Date.now();

    try {
      const baseUrl = gatewayBaseUrl();
      const apiKey = gatewayKey();

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          model: useModel,
          max_tokens: 1024,
          temperature: 0.7,
          stream: false,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gateway error:", response.status, errorText);
        return NextResponse.json(
          {
            error: `Gateway returned ${response.status}: ${errorText}`,
            elapsedMs: elapsed,
          },
          { status: 500 }
        );
      }

      const data = await response.json();
      console.log("Gateway response:", JSON.stringify(data, null, 2));

      // Try multiple response formats
      let text = "";

      // OpenAI format: choices[0].message.content
      if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
        text = data.choices[0].message?.content?.trim() || "";
      }

      // Anthropic format: content[0].text
      if (!text && data.content && Array.isArray(data.content)) {
        text =
          data.content
            .map((block: { text?: string }) => block.text || "")
            .join("\n")
            .trim() || "";
      }

      // Direct text field
      if (!text && typeof data.text === "string") {
        text = data.text.trim();
      }

      // Direct response field
      if (!text && typeof data.response === "string") {
        text = data.response.trim();
      }

      if (!text) {
        console.error("Unknown response format:", data);
        return NextResponse.json(
          {
            error: "Gateway returned unexpected format",
            elapsedMs: elapsed,
            rawData: data,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        response: text,
        provider: "gateway",
        model: useModel,
        elapsedMs: elapsed,
        tokenEstimate: Math.ceil(text.length / 4),
      });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error("AI test failed:", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error testing AI:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด" },
      { status: 500 }
    );
  }
}
