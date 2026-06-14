/**
 * Tests: LINE intent normalizer helpers (post-LLM-router refactor)
 *
 * Since the webhook now routes all text through the LLM orchestrator, we keep
 * only the shared deterministic helpers (filters/term-detection/building
 * normalization) and test those.  Quick-intent routing tests have moved to
 * test-line-orchestrator-routing.ts.
 *
 * Usage:
 *   npx tsx test-line-normalizer.ts
 */

import {
  hasSummaryTerms,
  hasLocatorTerms,
  hasTrendTerms,
  hasInventoryContent,
  normalizeBuildingName,
  extractPartKeyword,
  extractInventoryFilters,
} from "./src/lib/ai-assistant/intent-normalizer";

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

// ── Test A: hasSummaryTerms ─────────────────────────────────────────

function testHasSummaryTerms() {
  console.log("\n=== Test A: hasSummaryTerms detection ===");

  const positive = [
    "สรุปสถานะสต๊อกอะไหล่ของ บล็อค 2 อาคาร ท.003",
    "ภาพรวมสต็อกอาคาร ท.021",
    "สถานะสต็อกตอนนี้",
    "อะไหล่ใกล้หมดมีอะไรบ้าง",
    "ต่ำกว่าขั้นต่ำมีอะไรบ้าง",
    "ต้องเติมอะไรบ้าง",
    "คงเหลือเท่าไหร่",
    "เหลือเท่าไหร่",
  ];

  for (const text of positive) {
    assert(hasSummaryTerms(text), `"${text.slice(0, 40)}" → hasSummaryTerms`);
  }

  const negative = [
    "ค้นหาเบรกเกอร์",
    "หา contactor",
    "มี LC1D40AP7 ไหม",
    "วันนี้อากาศดี",
    "ขอบคุณครับ",
  ];

  for (const text of negative) {
    assert(!hasSummaryTerms(text), `"${text}" → NOT hasSummaryTerms`);
  }
}

// ── Test B: hasLocatorTerms ─────────────────────────────────────────

function testHasLocatorTerms() {
  console.log("\n=== Test B: hasLocatorTerms detection ===");

  const positive = [
    "บล็อค 2",
    "บล็อก 1",
    "block 3",
    "บล้อค SPECIAL PART",
    "อาคาร ท.003",
    "ตึก ท.021",
    "ท.003",
    "building A",
    "plant 1",
  ];

  for (const text of positive) {
    assert(hasLocatorTerms(text), `"${text}" → hasLocatorTerms`);
  }

  const negative = [
    "ค้นหาเบรกเกอร์",
    "สรุปสต็อก",
    "วันนี้อากาศดี",
  ];

  for (const text of negative) {
    assert(!hasLocatorTerms(text), `"${text}" → NOT hasLocatorTerms`);
  }
}

// ── Test C: hasTrendTerms ───────────────────────────────────────────

function testHasTrendTerms() {
  console.log("\n=== Test C: hasTrendTerms detection ===");

  const positive = [
    "เดือนนี้เบิก contactor เยอะไหม",
    "สัปดาห์นี้เบิกอะไรไปบ้าง",
    "ปีนี้ใช้ breaker ไปกี่ตัว",
    "แนวโน้มการเบิก",
    "สถิติการเบิก",
    "ใช้ไปกี่ตัวแล้ว",
    "เบิก contactor กี่ครั้ง",
    "movement history",
    "usage trend",
    "ประวัติการเบิก",
  ];

  for (const text of positive) {
    assert(hasTrendTerms(text), `"${text.slice(0, 45)}" → hasTrendTerms`);
  }

  const negative = [
    "ค้นหาเบรกเกอร์",
    "สรุปสต็อก",
  ];

  for (const text of negative) {
    assert(!hasTrendTerms(text), `"${text}" → NOT hasTrendTerms`);
  }
}

// ── Test D: hasInventoryContent ─────────────────────────────────────

function testHasInventoryContent() {
  console.log("\n=== Test D: hasInventoryContent detection ===");

  const positive = [
    "contactor",
    "เบรกเกอร์",
    "เดือนนี้เบิก contactor",
    "ท.003",
    "บล็อค 2",
  ];

  const negative = [
    "hello world",
    "อากาศดี",
    "สวัสดีครับ",
  ];

  for (const text of positive) {
    assert(hasInventoryContent(text), `"${text}" → hasInventoryContent`);
  }
  for (const text of negative) {
    assert(!hasInventoryContent(text), `"${text}" → NOT hasInventoryContent`);
  }
}

// ── Test E: Building name normalization ────────────────────────────

function testNormalizeBuildingName() {
  console.log("\n=== Test E: normalizeBuildingName ===");

  const cases: Array<[string | null | undefined, string | null]> = [
    [null, null],
    [undefined, null],
    ["", null],
    ["  ", null],
    ["003", "ท.003"],
    ["ท003", "ท.003"],
    ["ท.003", "ท.003"],
    ["อาคาร ท.003", "ท.003"],
    ["ตึก ท.003", "ท.003"],
    ["อาคาร   ท.003", "ท.003"],
    ["อาคารท003", "ท.003"],
    ["ท.021", "ท.021"],
    ["021", "ท.021"],
    ["ท021", "ท.021"],
    ["OTHER-BUILDING", "OTHER-BUILDING"],
    ["ท.003x", "ท.003x"],
    ["999", "ท.999"],
  ];

  for (const [input, expected] of cases) {
    const result = normalizeBuildingName(input);
    assert(
      result === expected,
      `normalizeBuildingName(${JSON.stringify(input)}) → ${JSON.stringify(result)} (expected ${JSON.stringify(expected)})`,
    );
  }
}

// ── Test F: extractPartKeyword ────────────────────────────────────

function testExtractPartKeyword() {
  console.log("\n=== Test F: extractPartKeyword ===");

  assert(extractPartKeyword("contactor เหลือเท่าไหร่") === "contactor", 'extractPartKeyword "contactor"');
  assert(extractPartKeyword("เบรกเกอร์ มีกี่ตัว") === "เบรกเกอร์", 'extractPartKeyword "เบรกเกอร์"');
  assert(extractPartKeyword("LC1D40AP7 คงเหลือเท่าไหร่") === "LC1D40AP7", 'extractPartKeyword "LC1D40AP7"');
  assert(extractPartKeyword('"contactor" เหลือเท่าไหร่') === "contactor", 'extractPartKeyword strips quotes');
  assert(extractPartKeyword("สรุปสถานะสต็อก") === null, 'extractPartKeyword summary → null');
  assert(extractPartKeyword("คงเหลือทั้งหมด") === null, 'extractPartKeyword "คงเหลือทั้งหมด" → null');
}

// ── Test G: extractInventoryFilters ─────────────────────────────────

function testExtractInventoryFilters() {
  console.log("\n=== Test G: extractInventoryFilters ===");

  const r1 = extractInventoryFilters("contactor บล็อค 2 อาคาร ท.003");
  assert(r1.keyword === "contactor", `keyword="${r1.keyword}" (expected "contactor")`);
  assert(r1.plant === "2", `plant="${r1.plant}" (expected "2")`);
  assert(r1.buildingName === "ท.003", `building="${r1.buildingName}" (expected "ท.003")`);

  const r2 = extractInventoryFilters("สรุปสถานะสต็อก");
  assert(r2.keyword === null, `no keyword → null (got "${r2.keyword}")`);
  assert(r2.plant === null, `no plant → null (got "${r2.plant}")`);
  assert(r2.buildingName === null, `no building → null (got "${r2.buildingName}")`);
}

// ── run ──
function main() {
  console.log("🔍 LINE Intent Normalizer Tests");
  console.log("================================");

  testHasSummaryTerms();
  testHasLocatorTerms();
  testHasTrendTerms();
  testHasInventoryContent();
  testNormalizeBuildingName();
  testExtractPartKeyword();
  testExtractInventoryFilters();

  console.log("\n================================");
  if (failures === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`❌ ${failures} test(s) failed`);
    process.exit(1);
  }
}

main();
