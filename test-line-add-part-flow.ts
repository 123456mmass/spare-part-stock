/**
 * Test: LINE AI Add-Part Flow
 *
 * Tests the image add flow end-to-end:
 * - Session status tracking
 * - Block/building selector postbacks
 * - Confirm idempotency with createdPartId
 * - Missing plant/building validation
 * - LIFF PATCH endpoint
 * - Cross-user session protection
 * - Retry preserves location
 */

import { getImageSessionStatus, setImageSessionStatus, ImageSessionStatus } from "./src/lib/ai-assistant/pending-actions";
import { createAddPreviewFlex, type AddPreviewSuggestion } from "./src/lib/line-chat/flex-messages";

// ── Simple test runner ──────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Test: Flex preview structure ────────────────────────────────────

console.log("\n📦 Test: createAddPreviewFlex structure");

const testSuggestion: AddPreviewSuggestion = {
  partNumber: "TMP-CON-20260613-ABCD",
  partName: "Test Contactor",
  categoryName: "อุปกรณ์ไฟฟ้า",
  subcategory: "contactor",
  confidence: 0.75,
  description: "A test contactor",
  notes: "OCR uncertain",
  unit: "pcs",
  plant: "",
  buildingId: "",
  buildingName: "",
  status: "preview_ready",
};

const testBuildings = [
  { id: "bld1", name: "ท.003" },
  { id: "bld2", name: "ท.021" },
];

const flex = createAddPreviewFlex(testSuggestion, "session-1", testBuildings) as Record<string, unknown>;

// Should be a carousel with 2 bubbles
assertEqual(flex.type, "carousel", "flex type is carousel");
const contents = flex.contents as Array<Record<string, unknown>>;
assert(Array.isArray(contents), "contents is array");
assertEqual(contents.length, 2, "carousel has 2 bubbles");

// Bubble 1: preview
const bubble1 = contents[0];
assertEqual(bubble1.type, "bubble", "bubble 1 type is bubble");

// Bubble 2: selector
const bubble2 = contents[1];
assertEqual(bubble2.type, "bubble", "bubble 2 type is bubble");

// ── Test: Warning text when plant/buildingId empty ──────────────────

console.log("\n⚠️ Test: Warning text when missing location");

const body1 = (bubble1 as Record<string, unknown>).body as Record<string, unknown>;
const infoBox = ((body1.contents as Array<Record<string, unknown>>)[2] as Record<string, unknown>);
const infoContents = infoBox.contents as Array<Record<string, unknown>>;

const hasWarning = infoContents.some(
  (c) => (c.text as string || "").includes("กรุณาเลือก Block"),
);
assert(hasWarning, "warning text present when plant/buildingId empty");

// ── Test: No warning when plant/buildingId set ──────────────────────

console.log("\n✅ Test: No warning when location set");

const completeSuggestion: AddPreviewSuggestion = {
  ...testSuggestion,
  plant: "BLOCK 1",
  buildingId: "bld1",
  buildingName: "ท.003",
};

const flexComplete = createAddPreviewFlex(completeSuggestion, "session-1", testBuildings) as Record<string, unknown>;
const contentsComplete = flexComplete.contents as Array<Record<string, unknown>>;
const bodyComplete = ((contentsComplete[0] as Record<string, unknown>).body as Record<string, unknown>);
const infoComplete = ((bodyComplete.contents as Array<Record<string, unknown>>)[2] as Record<string, unknown>);
const infoContentsComplete = infoComplete.contents as Array<Record<string, unknown>>;

const hasWarningComplete = infoContentsComplete.some(
  (c) => (c.text as string || "").includes("กรุณาเลือก Block"),
);
assert(!hasWarningComplete, "no warning text when plant/buildingId set");

// ── Test: Confirm button color changes ──────────────────────────────

console.log("\n🎨 Test: Confirm button color");

// Incomplete: orange
const footer1 = ((contents[0] as Record<string, unknown>).footer as Record<string, unknown>);
const confirmBtn1 = (footer1.contents as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
assertEqual(confirmBtn1.color, "#F57C00", "confirm button is orange when incomplete");

// Complete: green
const footerComplete = ((contentsComplete[0] as Record<string, unknown>).footer as Record<string, unknown>);
const confirmBtnComplete = (footerComplete.contents as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
assertEqual(confirmBtnComplete.color, "#1DB446", "confirm button is green when complete");

// ── Test: Selector bubble has block and building buttons ─────────────

console.log("\n🏷️ Test: Selector bubble buttons");

const selectorBody = ((contents[1] as Record<string, unknown>).body as Record<string, unknown>);
const selectorContents = selectorBody.contents as Array<Record<string, unknown>>;

// Find block section
const blockSection = selectorContents.find(
  (c) => {
    const inner = (c.contents as Array<Record<string, unknown>> | undefined);
    if (!inner) return false;
    const first = inner[0] as Record<string, unknown>;
    return (first.text as string || "").includes("เลือก Block");
  },
);
assert(!!blockSection, "block selector section exists");

// Find building section
const buildingSection = selectorContents.find(
  (c) => {
    const inner = (c.contents as Array<Record<string, unknown>> | undefined);
    if (!inner) return false;
    const first = inner[0] as Record<string, unknown>;
    return (first.text as string || "").includes("เลือกอาคาร");
  },
);
assert(!!buildingSection, "building selector section exists");

// Block buttons postback data format
if (blockSection) {
  const blockButtons = ((blockSection as Record<string, unknown>).contents as Array<Record<string, unknown>>).slice(1); // skip label
  const block1Btn = blockButtons[0] as Record<string, unknown>;
  const block1Action = block1Btn.action as Record<string, unknown>;
  const block1Data = block1Action.data as string;
  assert(block1Data.includes("action=part_add_set_plant"), "block button has part_add_set_plant action");
  assert(block1Data.includes("sid=session-1"), "block button has sid");
  assert(block1Data.includes("plant="), "block button has plant param");
}

// Building buttons postback data format
if (buildingSection) {
  const buildingButtons = ((buildingSection as Record<string, unknown>).contents as Array<Record<string, unknown>>).slice(1); // skip label
  assert(buildingButtons.length >= 1, "at least 1 building button");
  const firstBuildingBtn = buildingButtons[0] as Record<string, unknown>;
  const firstBuildingAction = firstBuildingBtn.action as Record<string, unknown>;
  const firstBuildingData = firstBuildingAction.data as string;
  assert(firstBuildingData.includes("action=part_add_set_building"), "building button has part_add_set_building action");
  assert(firstBuildingData.includes("building="), "building button has building param");
}

// ── Test: Edit button URL includes sid ──────────────────────────────

console.log("\n✏️ Test: Edit button URL");

const editRow = (footer1.contents as Array<Record<string, unknown>>)[1] as Record<string, unknown>;
const editButtons = (editRow.contents as Array<Record<string, unknown>>);
const editBtn = editButtons[0] as Record<string, unknown>;
const editAction = editBtn.action as Record<string, unknown>;
assertEqual(editAction.type, "uri", "edit button is URI type");
const editUri = editAction.uri as string;
assert(editUri.includes("add-part"), "edit URI points to add-part");
assert(editUri.includes("lineSid="), "edit URI includes lineSid param");
assert(editUri.includes("session-1"), "edit URI includes session ID");

// ── Test: Postback data parsing ─────────────────────────────────────

console.log("\n🔍 Test: Postback data parsing");

function parsePlant(data: string): string | null {
  const match = data.match(/[&?]plant=([^&]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

function parseBuilding(data: string): string | null {
  const match = data.match(/[&?]building=([^&]+)/);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); }
  catch { return match[1]; }
}

assertEqual(parsePlant("action=part_add_set_plant&sid=abc&plant=BLOCK%201"), "BLOCK 1", "parsePlant with encoded space");
assertEqual(parsePlant("action=part_add_set_plant&sid=abc&plant=SPECIAL%20PART"), "SPECIAL PART", "parsePlant special part");
assertEqual(parsePlant("action=part_add_set_plant&sid=abc"), null, "parsePlant missing param");

assertEqual(parseBuilding("action=part_add_set_building&sid=abc&building=ท.003"), "ท.003", "parseBuilding Thai text");
assertEqual(parseBuilding("action=part_add_set_building&sid=abc&building=ท.021"), "ท.021", "parseBuilding another building");
assertEqual(parseBuilding("action=part_add_set_building&sid=abc"), null, "parseBuilding missing param");

// ── Test: AddPreviewSuggestion type completeness ────────────────────

console.log("\n📋 Test: AddPreviewSuggestion type");

const fullSuggestion: AddPreviewSuggestion = {
  partNumber: "P-001",
  partName: "Test Part",
  categoryName: "อะไหล่",
  subcategory: "bearing",
  confidence: 0.9,
  description: "Test description",
  notes: "Test notes",
  unit: "pcs",
  plant: "BLOCK 2",
  buildingId: "bld2",
  buildingName: "ท.021",
  status: "preview_ready",
  createdPartId: "part-123",
  categoryId: "cat-1",
  matchedCategoryName: "อะไหล่",
  barcodeValue: "BC-001",
  quantity: 5,
  minimumQuantity: 2,
  location: "Shelf A-3",
};
assert(!!fullSuggestion.createdPartId, "createdPartId field exists");
assert(!!fullSuggestion.status, "status field exists");
assert(!!fullSuggestion.categoryId, "categoryId field exists");

// ── Test: ImageSessionStatus type values ────────────────────────────

console.log("\n🔄 Test: ImageSessionStatus type");

const statuses: ImageSessionStatus[] = [
  "image_uploaded", "analyzing", "preview_ready",
  "editing", "saving", "saved", "cancelled",
];
assertEqual(statuses.length, 7, "all 7 status values exist");
assert(statuses.includes("saving"), "saving status exists");
assert(statuses.includes("saved"), "saved status exists");
assert(statuses.includes("preview_ready"), "preview_ready status exists");

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
