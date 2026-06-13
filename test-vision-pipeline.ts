/**
 * Test script: Vision pipeline — mocked fetch, no real gateway/Prisma dependency.
 *
 * Usage:
 *   npx tsx test-vision-pipeline.ts
 *
 * Assertions:
 *   1. visionModel() / currentVisionModel() work per SPARE_PART_AI_VISION_MODEL
 *   2. callPartAi() sends OpenAI multimodal payload (content array, image_url, text block)
 *   3. Diagnostics shape + no base64/API-key leaks
 *   4. Text-only request flattens content to string, diagnostics = text-only
 */

import {
  callPartAi,
  currentVisionModel,
  visionModel,
  gatewayKey,
  extractTextFromOpenAIStream,
  type AiContentBlock,
} from "./src/lib/ai-client";

// ── helpers ──────────────────────────────────────────────────────────

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// Minimal 1×1 red PNG base64 (67 bytes)
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const MOCK_RESPONSE = { output_text: "mock text response" };

// ── fetch mock infra ─────────────────────────────────────────────────

type FetchMock = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

let capturedBody: Record<string, unknown> | null = null;
let capturedUrl = "";
let capturedHeaders: Record<string, string> = {};

function installFetchMock(): FetchMock {
  const realFetch = global.fetch;
  const mock: FetchMock = async (_url, init) => {
    capturedUrl = String(_url);
    capturedHeaders = {};
    if (init?.headers) {
      const h = init.headers;
      if (h instanceof Headers) {
        h.forEach((v, k) => (capturedHeaders[k] = v));
      } else if (Array.isArray(h)) {
        for (const [k, v] of h) capturedHeaders[k] = v;
      } else {
        Object.assign(capturedHeaders, h);
      }
    }
    if (init?.body && typeof init.body === "string") {
      capturedBody = JSON.parse(init.body);
    }
    return new Response(JSON.stringify(MOCK_RESPONSE), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  global.fetch = mock as typeof global.fetch;
  return realFetch;
}

function restoreFetch(original: FetchMock) {
  global.fetch = original as typeof global.fetch;
}

// ── tests ────────────────────────────────────────────────────────────

function testVisionModelConfig() {
  console.log("\n=== Test 1: Vision model config ===");

  // Without env
  const prev = process.env.SPARE_PART_AI_VISION_MODEL;
  delete process.env.SPARE_PART_AI_VISION_MODEL;
  assert(visionModel() === "", "visionModel() returns '' when SPARE_PART_AI_VISION_MODEL not set");

  // With env
  process.env.SPARE_PART_AI_VISION_MODEL = "test-vision-model";
  assert(visionModel() === "test-vision-model", "visionModel() returns env value when set");

  // currentVisionModel() with env set — bypasses Prisma
  currentVisionModel().then((m) => {
    assert(m === "test-vision-model", `currentVisionModel() uses env (got "${m}")`);
  });

  // Restore
  if (prev) process.env.SPARE_PART_AI_VISION_MODEL = prev;
  else delete process.env.SPARE_PART_AI_VISION_MODEL;
}

async function testMultimodalRequestBody() {
  console.log("\n=== Test 2: Multimodal request body (mocked fetch) ===");

  // Set env so no Prisma hit
  process.env.SPARE_PART_AI_VISION_MODEL = "test-vision-model";
  process.env.SPARE_PART_AI_GATEWAY_KEY = "test-gateway-key";

  const origFetch = installFetchMock();

  const imageBlock: AiContentBlock = {
    type: "image",
    imageBase64: TINY_PNG_B64,
    mediaType: "image/png",
  };
  const textBlock: AiContentBlock = {
    type: "text",
    text: "Describe this image.",
  };

  let result;
  try {
    result = await callPartAi(
      [imageBlock, textBlock],
      { maxTokens: 50, temperature: 0, timeoutMs: 10_000 },
      "test-vision-model",
    );
  } catch (err) {
    assert(false, `callPartAi threw: ${(err as Error).message}`);
    restoreFetch(origFetch);
    return;
  } finally {
    restoreFetch(origFetch);
    delete process.env.SPARE_PART_AI_GATEWAY_KEY;
    delete process.env.SPARE_PART_AI_VISION_MODEL;
  }

  // ── request body assertions ──
  assert(capturedBody !== null, "fetch was called (capturedBody exists)");
  if (!capturedBody) return;

  const body = capturedBody;

  // model
  assert(
    body.model === "test-vision-model",
    `model = "test-vision-model" (got "${body.model}")`,
  );

  // messages
  const messages = body.messages as Array<{ role: string; content: unknown }> | undefined;
  assert(Array.isArray(messages), "messages is an array");
  if (!messages) return;

  assert(messages.length === 1, "messages has 1 entry");
  const msg = messages[0];
  assert(msg.role === "user", `role = "user" (got "${msg.role}")`);

  // content must be an array (multimodal)
  const content = msg.content;
  assert(Array.isArray(content), "content is an array (multimodal)");
  if (!Array.isArray(content)) return;

  // Find image_url block
  const imgBlock = content.find(
    (p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "image_url",
  ) as Record<string, unknown> | undefined;
  assert(imgBlock !== undefined, "content has an image_url block");

  if (imgBlock) {
    const iu = imgBlock.image_url as Record<string, unknown> | undefined;
    const url = iu?.url as string | undefined;
    assert(
      typeof url === "string" && url.startsWith("data:image/png;base64,"),
      `image_url.url starts with "data:image/png;base64," (got prefix: "${String(url).substring(0, 35)}")`,
    );
    assert(
      url!.includes(TINY_PNG_B64),
      "image_url.url contains the source base64",
    );
  }

  // text block
  const txtBlock = content.find(
    (p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "text",
  ) as Record<string, unknown> | undefined;
  assert(txtBlock !== undefined, "content has a text block");
  if (txtBlock) {
    assert(txtBlock.text === "Describe this image.", `text block preserved (got "${txtBlock.text}")`);
  }

  // ── auth header ──
  assert(
    capturedHeaders.authorization === "Bearer test-gateway-key",
    `Authorization header present (got "${capturedHeaders.authorization}")`,
  );

  // ── result assertions ──
  assert(result.text === "mock text response", "callPartAi returned mock text");

  // ── diagnostics ──
  const d = result.diagnostics;
  assert(d !== undefined, "diagnostics is present");
  if (!d) return;

  assert(d.requestMode === "multimodal", `requestMode = "multimodal" (got "${d.requestMode}")`);
  assert(d.imageBlockCount === 1, `imageBlockCount = 1 (got ${d.imageBlockCount})`);
  assert(d.mediaTypes.includes("image/png"), `mediaTypes includes "image/png" (got [${d.mediaTypes}])`);
  assert(d.model === "test-vision-model", `diagnostics.model = "test-vision-model" (got "${d.model}")`);
  assert(d.provider === "gateway", `provider = "gateway" (got "${d.provider}")`);
  assert(typeof d.latencyMs === "number" && d.latencyMs >= 0, "latencyMs is non-negative number");

  // Leak check
  const diagJson = JSON.stringify(d);
  assert(!diagJson.includes(TINY_PNG_B64), "diagnostics JSON does not contain raw base64");
  assert(!diagJson.includes("test-gateway-key"), "diagnostics JSON does not contain API key");
}

async function testTextOnlyRequestBody() {
  console.log("\n=== Test 3: Text-only request body (mocked fetch) ===");

  process.env.SPARE_PART_AI_GATEWAY_KEY = "test-key-2";

  const origFetch = installFetchMock();

  let result;
  try {
    result = await callPartAi(
      [{ type: "text", text: "Say ok" }],
      { maxTokens: 10, temperature: 0, timeoutMs: 5_000 },
      "text-model",
    );
  } catch (err) {
    assert(false, `callPartAi text-only threw: ${(err as Error).message}`);
    restoreFetch(origFetch);
    return;
  } finally {
    restoreFetch(origFetch);
    delete process.env.SPARE_PART_AI_GATEWAY_KEY;
  }

  assert(capturedBody !== null, "fetch was called");
  if (!capturedBody) return;

  const content = (capturedBody.messages as Array<{ role: string; content: unknown }>)?.[0]?.content;
  assert(typeof content === "string", `content is a string for text-only (got ${typeof content})`);
  assert(content === "Say ok", `content is the original text (got "${String(content)}")`);

  const d = result.diagnostics;
  assert(d !== undefined, "diagnostics present for text-only");
  if (d) {
    assert(d.requestMode === "text-only", `requestMode = "text-only"`);
    assert(d.imageBlockCount === 0, "imageBlockCount = 0");
  }
}

// ── SSE stream parsing tests ──────────────────────────────────────────

function testStreamParsing() {
  console.log("\n=== Test 4: SSE stream parsing ===");

  // ── a) SSE error frame → throw ──
  const errorSSE =
    'data: {"error":{"type":"invalid_request","message":"Invalid request."}}\n\n';
  try {
    extractTextFromOpenAIStream(errorSSE);
    assert(false, "SSE error frame should throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert(
      msg.includes("gateway stream error"),
      `error message contains "gateway stream error" (got "${msg}")`,
    );
    assert(
      msg.includes("invalid_request"),
      `error message contains error type (got "${msg}")`,
    );
    assert(
      msg.includes("Invalid request."),
      `error message contains error message (got "${msg}")`,
    );
  }

  // ── b) SSE reasoning_content only, no content delta → return "" ──
  const reasoningSSE =
    'data: {"choices":[{"delta":{"reasoning_content":"thinking about the image..."}}]}\n\n' +
    "data: [DONE]\n\n";
  const resultB = extractTextFromOpenAIStream(reasoningSSE);
  assert(
    resultB === "",
    `reasoning_content-only SSE returns "" (got "${resultB}")`,
  );

  // ── c) SSE content delta → accumulate text ──
  const contentSSE =
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":" World"}}]}\n\n' +
    "data: [DONE]\n\n";
  const resultC = extractTextFromOpenAIStream(contentSSE);
  assert(
    resultC === "Hello World",
    `content delta accumulates correctly (got "${resultC}")`,
  );

  // ── d) SSE error AFTER some content → throws (error wins) ──
  const errorAfterContent =
    'data: {"choices":[{"delta":{"content":"partial response"}}]}\n\n' +
    'data: {"error":{"type":"server_error","message":"overloaded"}}\n\n';
  try {
    extractTextFromOpenAIStream(errorAfterContent);
    assert(false, "SSE error after content should throw");
  } catch (err) {
    const msg = (err as Error).message;
    assert(
      msg.includes("gateway stream error"),
      `error after content: message contains "gateway stream error" (got "${msg}")`,
    );
    assert(
      msg.includes("server_error"),
      `error after content: message contains error type (got "${msg}")`,
    );
  }

  // ── e) Mixed content + reasoning_content → only content accumulated ──
  const mixedSSE =
    'data: {"choices":[{"delta":{"reasoning_content":"hmm"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"JSON"}}]}\n\n' +
    'data: {"choices":[{"delta":{"reasoning_content":"more thinking","content":" output"}}]}\n\n' +
    "data: [DONE]\n\n";
  const resultE = extractTextFromOpenAIStream(mixedSSE);
  assert(
    resultE === "JSON output",
    `mixed: only content accumulated, not reasoning (got "${resultE}")`,
  );

  // ── f) Normal [DONE] termination, no error → return accumulated text ──
  const normalSSE =
    'data: {"choices":[{"delta":{"content":"{\\"partNumber\\":\\"LC1D09\\"}"}}]}\n\n' +
    "data: [DONE]\n\n";
  const resultF = extractTextFromOpenAIStream(normalSSE);
  assert(
    resultF === '{"partNumber":"LC1D09"}',
    `normal SSE returns accumulated JSON (got "${resultF}")`,
  );

  // ── g) Empty stream → return "" (no error, caller handles) ──
  const emptySSE = "data: [DONE]\n\n";
  const resultG = extractTextFromOpenAIStream(emptySSE);
  assert(resultG === "", `empty SSE returns "" (got "${resultG}")`);
}

// ── entry ────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Vision Pipeline Test Suite (mocked)");
  console.log("======================================");

  testVisionModelConfig();

  // Let the async currentVisionModel check settle
  await new Promise((r) => setTimeout(r, 50));

  await testMultimodalRequestBody();
  await testTextOnlyRequestBody();
  testStreamParsing();

  console.log("\n======================================");
  if (failures === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`❌ ${failures} test(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
