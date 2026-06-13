/**
 * Unit tests: post-parse defaults for suggestPartFromImage
 *
 * Zero gateway dependency — tests applyPostParseDefaults + defaultMinQty only.
 *
 * Usage:
 *   npx tsx test-part-ai-defaults.ts
 */

import { applyPostParseDefaults, defaultMinQty, generateProvisionalPartNumber, hasPositivePartNumberEvidence, formatLocalDateYYYYMMDD, isPartNumberUncertain } from "./src/lib/part-ai";

let failures = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// ── minimal input type (matches z.infer<typeof aiSuggestionSchema>) ──
type Suggestion = {
  partNumber: string;
  partName: string;
  description: string;
  categoryName: string;
  subcategory: string;
  location: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  barcodeValue: string | null;
  confidence: number;
  notes: string;
  partNumberCandidates: string[];
  partNumberConfidence: number | null;
  uncertainPartNumberChars: string[];
};

function mk(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    partNumber: "",
    partName: "",
    description: "",
    categoryName: "",
    subcategory: "",
    location: "",
    quantity: 1,
    minimumQuantity: 0,
    unit: "pcs",
    barcodeValue: null,
    confidence: 0.8,
    notes: "",
    partNumberCandidates: [],
    partNumberConfidence: null,
    uncertainPartNumberChars: [],
    ...overrides,
  };
}

const TMP_PREFIXES = [
  "TMP-CON", "TMP-RLY", "TMP-BRK", "TMP-BRG", "TMP-SEN",
  "TMP-SOL", "TMP-TRM", "TMP-PNF", "TMP-MTR", "TMP-FUS",
  "TMP-CNN", "TMP-SPP",
];

function isProvisional(pn: string): boolean {
  return TMP_PREFIXES.some((p) => pn.startsWith(p));
}

// ── Test 1: partNumber — never empty, provisional when no evidence ──
function testPartNumberPolicy() {
  console.log("\n=== Test 1: partNumber — never empty ===");

  // No label evidence, no barcode → provisional
  let result = applyPostParseDefaults(
    mk({ partNumber: "ABC123", notes: "visual: 3-pole contactor" }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `partNumber is TMP-* provisional when no label/OCR evidence (got "${result.partNumber}")`,
  );
  assert(
    result.partNumber !== "",
    `partNumber is never empty (got "${result.partNumber}")`,
  );
  assert(
    result.confidence <= 0.75,
    `confidence capped at 0.75 for provisional (got ${result.confidence})`,
  );
  assert(
    /partNumber เป็นรหัสชั่วคราว/.test(result.notes),
    `notes says partNumber is provisional (got "${result.notes}")`,
  );

  // Label evidence → keep real partNumber
  result = applyPostParseDefaults(
    mk({ partNumber: "LC1D09", notes: "label: Schneider LC1D09, visual: contactor 3P 9A" }),
    null,
  );
  assert(
    result.partNumber === "LC1D09",
    `partNumber kept when notes has "label:" evidence (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "partNumber is NOT provisional when label evidence exists",
  );
  assert(
    !/รหัสชั่วคราว/.test(result.notes),
    `notes does NOT say provisional (got "${result.notes}")`,
  );

  // OCR evidence → keep real partNumber
  result = applyPostParseDefaults(
    mk({ partNumber: "XYZ789", notes: "OCR: XYZ789 on nameplate" }),
    null,
  );
  assert(
    result.partNumber === "XYZ789",
    `partNumber kept with OCR evidence (got "${result.partNumber}")`,
  );
}

// ── Test 1b: generateProvisionalPartNumber format ──
function testProvisionalFormat() {
  console.log("\n=== Test 1b: Provisional partNumber format ===");

  const pn = generateProvisionalPartNumber("Contactor", "20260612");
  assert(
    /^TMP-CON-20260612-[A-HJ-NP-Z2-9]{4}$/.test(pn),
    `provisional format: TMP-CON-YYYYMMDD-XXXX (got "${pn}")`,
  );

  const pn2 = generateProvisionalPartNumber("Ball Bearing", "20260612");
  assert(pn2.startsWith("TMP-BRG-"), `Ball Bearing → TMP-BRG (got "${pn2}")`);

  const pn3 = generateProvisionalPartNumber("Sensor");
  assert(pn3.startsWith("TMP-SEN-"), `Sensor → TMP-SEN (got "${pn3}")`);

  const pn4 = generateProvisionalPartNumber("Solenoid Valve");
  assert(pn4.startsWith("TMP-SOL-"), `Solenoid Valve → TMP-SOL (got "${pn4}")`);

  const pn5 = generateProvisionalPartNumber("Fuse");
  assert(pn5.startsWith("TMP-FUS-"), `Fuse → TMP-FUS (got "${pn5}")`);

  const pn6 = generateProvisionalPartNumber("Connector");
  assert(pn6.startsWith("TMP-CNN-"), `Connector → TMP-CNN (got "${pn6}")`);

  const pn7 = generateProvisionalPartNumber("Widget");
  assert(pn7.startsWith("TMP-SPP-"), `Unknown → TMP-SPP (got "${pn7}")`);

  // Without dateStr, should use local date
  const pnLocal = generateProvisionalPartNumber("Contactor");
  const localDate = formatLocalDateYYYYMMDD();
  assert(
    pnLocal.startsWith(`TMP-CON-${localDate}-`),
    `provisional uses local date ${localDate} (got "${pnLocal}")`,
  );
}

// ── Test 1c: hasPositivePartNumberEvidence ──
function testPositivePartNumberEvidence() {
  console.log("\n=== Test 1c: hasPositivePartNumberEvidence ===");

  // Real label evidence with actual model#
  assert(
    hasPositivePartNumberEvidence("label: Schneider LC1D09, visual: 3P contactor", "LC1D09"),
    "positive: label with real model#",
  );

  // Real OCR evidence
  assert(
    hasPositivePartNumberEvidence("OCR: XYZ789 on nameplate", "XYZ789"),
    "positive: OCR with real code",
  );

  // Label says "none" — NOT positive
  assert(
    !hasPositivePartNumberEvidence("visual: contactor, label: none, OCR: unreadable", "ABC123"),
    "negative: label: none",
  );

  // Label says "no label" — NOT positive
  assert(
    !hasPositivePartNumberEvidence("visual: motor, label: no label", "GUESS"),
    "negative: label: no label",
  );

  // Label says "not visible" — NOT positive
  assert(
    !hasPositivePartNumberEvidence("label: not visible, OCR: blurry", "X"),
    "negative: label: not visible + OCR: blurry",
  );

  // Label says "unreadable" — NOT positive
  assert(
    !hasPositivePartNumberEvidence("label: unreadable, visual: bearing", "XYZ"),
    "negative: label: unreadable",
  );

  // OCR says "unknown" — NOT positive
  assert(
    !hasPositivePartNumberEvidence("OCR: unknown", "MODEL"),
    "negative: OCR: unknown",
  );

  // Visible model but in negative context
  assert(
    !hasPositivePartNumberEvidence("visual: contactor, no visible model", "ABC"),
    "negative: 'no visible model'",
  );

  // Empty notes
  assert(
    !hasPositivePartNumberEvidence("", "ABC123"),
    "negative: empty notes",
  );

  // Empty partNumber
  assert(
    !hasPositivePartNumberEvidence("label: LC1D09", ""),
    "negative: empty partNumber",
  );

  // Notes with label but no alphanumeric in the label segment
  assert(
    !hasPositivePartNumberEvidence("label: none", "ABC"),
    "negative: label segment has only negative word",
  );

  // true positive with "visible model" + real code
  assert(
    hasPositivePartNumberEvidence("visible model LC1D09 on nameplate", "LC1D09"),
    "positive: visible model with real code",
  );

  // PartNumber IS in segment but IS a brand-only word → REJECT
  assert(
    !hasPositivePartNumberEvidence("label: Schneider, visual: contactor 3P", "Schneider"),
    "negative: partNumber='Schneider' is brand-only, not a model/SKU",
  );

  // Label segment has brand word but no model/SKU token → REJECT
  assert(
    !hasPositivePartNumberEvidence("label: Omron Relay, visual: 8-pin", "MY2N"),
    "negative: label has brand-only 'Omron', no model/SKU token",
  );

  // Label segment has a real model/SKU token → ACCEPT
  assert(
    hasPositivePartNumberEvidence("label: 6204ZZ, visual: deep groove bearing", "6204ZZ"),
    "positive: 6204ZZ is a model/SKU token",
  );

  // OCR segment has model/SKU → ACCEPT even if label is brand-only
  assert(
    hasPositivePartNumberEvidence("label: SKF, OCR: 6204ZZ", "6204ZZ"),
    "positive: OCR has model/SKU 6204ZZ",
  );

  // OCR segment has brand-only word, no model/SKU → REJECT
  assert(
    !hasPositivePartNumberEvidence("label: none, OCR: SKF", "SKF"),
    "negative: OCR has brand-only 'SKF', no model/SKU",
  );
}

// ── Test 1d: Negative evidence → provisional (AI guess NOT kept) ──
function testNegativeEvidenceGeneratesProvisional() {
  console.log("\n=== Test 1d: Negative evidence → TMP-* provisional ===");

  // Case: partNumber="ABC123", notes="visual: contactor, label: none, OCR: unreadable" → TMP
  let result = applyPostParseDefaults(
    mk({
      partNumber: "ABC123",
      notes: "visual: contactor, label: none, OCR: unreadable",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `label:none + OCR:unreadable + AI guess → TMP-* (got "${result.partNumber}")`,
  );
  assert(
    result.confidence <= 0.75,
    `confidence capped for provisional (got ${result.confidence})`,
  );

  // Case: partNumber="XYZ", notes="label: no label" → TMP
  result = applyPostParseDefaults(
    mk({
      partNumber: "XYZ",
      subcategory: "Contactor",
      notes: "label: no label",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `label: no label + AI guess → TMP-* (got "${result.partNumber}")`,
  );

  // Case: partNumber="GUESS", notes="OCR: blurry" → TMP
  result = applyPostParseDefaults(
    mk({
      partNumber: "GUESS",
      subcategory: "Relay",
      notes: "OCR: blurry",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `OCR: blurry + AI guess → TMP-* (got "${result.partNumber}")`,
  );

  // Case: label: none, OCR: unreadable + scannedBarcode → use barcode, not AI guess
  result = applyPostParseDefaults(
    mk({
      partNumber: "AI_GUESS_123",
      subcategory: "Breaker",
      notes: "visual: breaker 2P, label: none, OCR: unreadable",
    }),
    "8859876543210",
  );
  assert(
    result.partNumber === "8859876543210",
    `scannedBarcode wins over AI guess when label: none (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "barcode partNumber is NOT provisional",
  );
}

// ── Test 2: partName auto-fill ──
function testPartNameDefaults() {
  console.log("\n=== Test 2: partName auto-fill ===");

  // subcategory present, partName empty
  let result = applyPostParseDefaults(
    mk({ partName: "", subcategory: "Contactor", categoryName: "อุปกรณ์ไฟฟ้า" }),
    null,
  );
  assert(
    result.partName === "Unknown Brand - Contactor",
    `partName = "Unknown Brand - Contactor" (got "${result.partName}")`,
  );

  // brand visible → keep it
  result = applyPostParseDefaults(
    mk({ partName: "Schneider - Contactor", subcategory: "Contactor" }),
    null,
  );
  assert(
    result.partName === "Schneider - Contactor",
    "partName preserved when provided by AI",
  );

  // subcategory empty, categoryName present → "Unknown - <category>"
  result = applyPostParseDefaults(
    mk({ partName: "", subcategory: "", categoryName: "ตลับลูกปืน" }),
    null,
  );
  assert(
    result.partName === "Unknown - ตลับลูกปืน",
    `partName filled from categoryName (got "${result.partName}")`,
  );

  // both empty → fallback
  result = applyPostParseDefaults(
    mk({ partName: "", subcategory: "", categoryName: "อะไหล่" }),
    null,
  );
  assert(
    result.partName === "Unknown - Spare Part",
    `partName ultimate fallback (got "${result.partName}")`,
  );
}

// ── Test 3: categoryName never empty ──
function testCategoryNameDefaults() {
  console.log("\n=== Test 3: categoryName defaults ===");

  let result = applyPostParseDefaults(
    mk({ categoryName: "", subcategory: "Relay" }),
    null,
  );
  assert(
    result.categoryName === "อะไหล่",
    `categoryName defaults to "อะไหล่" (got "${result.categoryName}")`,
  );

  result = applyPostParseDefaults(
    mk({ categoryName: "อุปกรณ์ไฟฟ้า", subcategory: "Breaker" }),
    null,
  );
  assert(
    result.categoryName === "อุปกรณ์ไฟฟ้า",
    `categoryName preserved when provided (got "${result.categoryName}")`,
  );
}

// ── Test 4: minimumQuantity per type ──
function testMinQtyDefaults() {
  console.log("\n=== Test 4: minimumQuantity per type ===");

  // Bearings, fuses, sensors → 2
  assert(defaultMinQty("Bearing") === 2, 'bearing → minQty 2');
  assert(defaultMinQty("Ball Bearing") === 2, 'ball bearing → minQty 2');
  assert(defaultMinQty("Fuse") === 2, 'fuse → minQty 2');
  assert(defaultMinQty("Sensor") === 2, 'sensor → minQty 2');
  assert(defaultMinQty("Relay") === 2, 'relay → minQty 2');
  assert(defaultMinQty("Connector") === 2, 'connector → minQty 2');
  assert(defaultMinQty("Terminal Block") === 2, 'terminal block → minQty 2');
  assert(defaultMinQty("Cable") === 2, 'cable → minQty 2');
  assert(defaultMinQty("Cable Gland") === 2, 'cable gland → minQty 2');
  assert(defaultMinQty("Pneumatic Fitting") === 2, 'pneumatic fitting → minQty 2');
  assert(defaultMinQty("Push Button") === 2, 'push button → minQty 2');
  assert(defaultMinQty("Indicator Light") === 2, 'indicator light → minQty 2');

  // Motors, inverters, breakers → 1
  assert(defaultMinQty("Motor") === 1, 'motor → minQty 1');
  assert(defaultMinQty("Inverter") === 1, 'inverter → minQty 1');
  assert(defaultMinQty("Power Supply") === 1, 'power supply → minQty 1');
  assert(defaultMinQty("Breaker") === 1, 'breaker → minQty 1');
  assert(defaultMinQty("Contactor") === 1, 'contactor → minQty 1');
  assert(defaultMinQty("Solenoid Valve") === 1, 'solenoid valve → minQty 1');
  assert(defaultMinQty("PLC") === 1, 'plc → minQty 1');
  assert(defaultMinQty("Switch") === 1, 'switch → minQty 1');

  // Unknown type → 1
  assert(defaultMinQty("Widget") === 1, 'unknown → minQty 1');

  // ApplyDefaults sets minQty when AI returns 0
  let result = applyPostParseDefaults(
    mk({ minimumQuantity: 0, subcategory: "Contactor" }),
    null,
  );
  assert(
    result.minimumQuantity === 1,
    `contactor minQty=0 → defaulted to 1 (got ${result.minimumQuantity})`,
  );

  result = applyPostParseDefaults(
    mk({ minimumQuantity: 0, subcategory: "Fuse" }),
    null,
  );
  assert(
    result.minimumQuantity === 2,
    `fuse minQty=0 → defaulted to 2 (got ${result.minimumQuantity})`,
  );

  // AI returned explicit minQty → keep it
  result = applyPostParseDefaults(
    mk({ minimumQuantity: 5, subcategory: "Relay" }),
    null,
  );
  assert(
    result.minimumQuantity === 5,
    `explicit minQty=5 preserved (got ${result.minimumQuantity})`,
  );
}

// ── Test 5: Scanned barcode → partNumber ──
function testScannedBarcodePartNumber() {
  console.log("\n=== Test 5: Scanned barcode becomes partNumber ===");

  // scannedBarcode present, no label evidence, AI gave partNumber guess → prefer barcode
  let result = applyPostParseDefaults(
    mk({ partNumber: "GUESS123", notes: "visual: contactor 3-pole" }),
    "8851234567890",
  );
  assert(
    result.partNumber === "8851234567890",
    `scannedBarcode overrides AI guess partNumber (got "${result.partNumber}")`,
  );

  // scannedBarcode present, no partNumber from AI → use barcode as partNumber
  result = applyPostParseDefaults(
    mk({ partNumber: "", notes: "visual: contactor" }),
    "8851234567890",
  );
  assert(
    result.partNumber === "8851234567890",
    `scannedBarcode becomes partNumber when AI gave none (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "barcode partNumber is NOT provisional",
  );

  // label evidence + scannedBarcode → keep real model#, barcode is barcodeValue (handled elsewhere)
  result = applyPostParseDefaults(
    mk({ partNumber: "LC1D09", notes: "label: Schneider LC1D09, visual: contactor 3P" }),
    "8851234567890",
  );
  assert(
    result.partNumber === "LC1D09",
    `label model# kept when both label and scannedBarcode exist (got "${result.partNumber}")`,
  );

  // scannedBarcode present, no label, AI also empty → use barcode
  result = applyPostParseDefaults(
    mk({ partNumber: "", subcategory: "Contactor", notes: "visual: contactor white" }),
    "8851234567890",
  );
  assert(
    result.partNumber === "8851234567890",
    `scannedBarcode fills empty partNumber (got "${result.partNumber}")`,
  );
}

// ── Test 6: unit default ──
function testUnitDefault() {
  console.log("\n=== Test 6: unit default ===");

  let result = applyPostParseDefaults(mk({ unit: "" }), null);
  assert(result.unit === "pcs", `unit defaults to "pcs" (got "${result.unit}")`);

  result = applyPostParseDefaults(mk({ unit: "set" }), null);
  assert(result.unit === "set", "unit preserved when provided");
}

// ── Test 6b: Confidence zero NOT elevated to 0.8 ──
function testConfidenceZero() {
  console.log("\n=== Test 6b: confidence=0 NOT elevated ===");

  // confidence=0 is legit for completely unusable images — must stay 0
  let result = applyPostParseDefaults(
    mk({ partNumber: "", subcategory: "Contactor", confidence: 0, notes: "visual: totally dark" }),
    null,
  );
  assert(
    result.confidence === 0,
    `confidence=0 stays 0 (got ${result.confidence})`,
  );
  assert(
    isProvisional(result.partNumber),
    "provisional still generated when confidence=0",
  );

  // confidence=0.8 with label evidence → kept as-is
  result = applyPostParseDefaults(
    mk({ partNumber: "LC1D09", subcategory: "Contactor", confidence: 0.8, notes: "label: LC1D09" }),
    null,
  );
  assert(
    result.confidence === 0.8,
    `confidence=0.8 kept as-is (got ${result.confidence})`,
  );
}

// ── Test 7: Expected outputs for no-label images ──
function testNoLabelScenarios() {
  console.log("\n=== Test 7: No-label visual classification examples ===");

  // Scenario A: Visual-only Contactor — no label → provisional partNumber
  const contactor = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "",
      subcategory: "Contactor",
      categoryName: "อุปกรณ์ไฟฟ้า",
      description: "White 3-pole contactor with 1NO 1NC aux, din rail mount, ~45mm width, IEC standard",
      quantity: 1,
      confidence: 0.65,
      notes: "visual: white 3-pole contactor 1NO 1NC, no label visible",
    }),
    null,
  );
  assert(isProvisional(contactor.partNumber), "Scenario: partNumber is TMP-CON-* for visual-only contactor");
  assert(contactor.partNumber !== "", "Scenario: partNumber is never empty");
  assert(contactor.partName === "Unknown Brand - Contactor", `Scenario: partName "${contactor.partName}"`);
  assert(contactor.categoryName === "อุปกรณ์ไฟฟ้า", `Scenario: categoryName "${contactor.categoryName}"`);
  assert(contactor.minimumQuantity === 1, "Scenario: contactor minQty=1");
  assert(contactor.confidence <= 0.75, `Scenario: confidence ${contactor.confidence} ≤ 0.75`);
  assert(/รหัสชั่วคราว/.test(contactor.notes), "Scenario: notes says partNumber is provisional");

  // Scenario B: Visual-only bearing — no label → provisional
  const bearing = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "",
      subcategory: "Ball Bearing",
      categoryName: "ตลับลูกปืน",
      description: "Deep groove ball bearing, steel, double shielded, ~20mm bore, ~47mm OD, ~14mm width",
      quantity: 1,
      confidence: 0.6,
      notes: "visual: deep groove ball bearing, steel, 2RS sealed, no brand visible",
    }),
    null,
  );
  assert(isProvisional(bearing.partNumber), "Scenario: partNumber is TMP-BRG-* for visual-only bearing");
  assert(bearing.partName === "Unknown Brand - Ball Bearing", `Scenario: partName "${bearing.partName}"`);
  assert(bearing.categoryName === "ตลับลูกปืน", `Scenario: categoryName "${bearing.categoryName}"`);
  assert(bearing.minimumQuantity === 2, "Scenario: bearing minQty=2");

  // Scenario C: Visual-only sensor — no label → provisional
  const sensor = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "",
      subcategory: "Sensor",
      categoryName: "เซ็นเซอร์",
      description: "M18 cylindrical proximity sensor, PNP NO, shielded, cable pigtail, ~60mm length",
      quantity: 1,
      confidence: 0.7,
      notes: "visual: M18 proximity sensor, PNP, no model visible",
    }),
    null,
  );
  assert(isProvisional(sensor.partNumber), "Scenario: partNumber is TMP-SEN-* for visual-only sensor");
  assert(sensor.partName === "Unknown Brand - Sensor", `Scenario: partName "${sensor.partName}"`);
  assert(sensor.categoryName === "เซ็นเซอร์", `Scenario: categoryName "${sensor.categoryName}"`);
  assert(sensor.minimumQuantity === 2, "Scenario: sensor minQty=2");

  // Scenario D: Label+model visible → real partNumber, high confidence
  const labeled = applyPostParseDefaults(
    mk({
      partNumber: "LC1D09M7",
      partName: "Schneider - Contactor",
      subcategory: "Contactor",
      categoryName: "อุปกรณ์ไฟฟ้า",
      description: "Schneider Electric TeSys D, LC1D09, 9A, 3P, 220VAC coil, IEC/EN 60947, ใช้ควบคุมมอเตอร์/ปั๊ม",
      quantity: 1,
      confidence: 0.9,
      notes: "label: Schneider Electric LC1D09M7, visual: 3-pole contactor TeSys D, OCR: 220V 50/60Hz",
    }),
    null,
  );
  assert(labeled.partNumber === "LC1D09M7", "Scenario: partNumber kept for labeled part");
  assert(!isProvisional(labeled.partNumber), "Scenario: labeled partNumber is NOT provisional");
  assert(labeled.partName === "Schneider - Contactor", `Scenario: partName "${labeled.partName}"`);
  assert(labeled.confidence >= 0.85, `Scenario: confidence ${labeled.confidence} ≥ 0.85`);
  assert(!/รหัสชั่วคราว/.test(labeled.notes), "Scenario: notes does NOT say provisional for labeled part");

  // Scenario E: Scanned barcode → becomes partNumber
  const scanned = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "",
      subcategory: "Breaker",
      categoryName: "อุปกรณ์ไฟฟ้า",
      description: "MCB 2-pole 16A, din rail mount, white",
      quantity: 1,
      confidence: 0.6,
      notes: "visual: MCB 2-pole 16A, no label readable",
    }),
    "8851234567890",
  );
  assert(scanned.partNumber === "8851234567890", `Scenario: scannedBarcode → partNumber "${scanned.partNumber}"`);
  assert(!isProvisional(scanned.partNumber), "Scenario: barcode partNumber is NOT provisional");

  console.log("\n  Example outputs:");
  console.log(`  No-label contactor:  "${contactor.partNumber}" / "${contactor.partName}" / ${contactor.categoryName} / confidence=${contactor.confidence} / minQty=${contactor.minimumQuantity}`);
  console.log(`  No-label bearing:    "${bearing.partNumber}" / "${bearing.partName}" / ${bearing.categoryName} / confidence=${bearing.confidence} / minQty=${bearing.minimumQuantity}`);
  console.log(`  No-label sensor:     "${sensor.partNumber}" / "${sensor.partName}" / ${sensor.categoryName} / confidence=${sensor.confidence} / minQty=${sensor.minimumQuantity}`);
  console.log(`  Labeled contactor:   "${labeled.partNumber}" / "${labeled.partName}" / confidence=${labeled.confidence}`);
  console.log(`  Scanned barcode:     "${scanned.partNumber}" / "${scanned.partName}" / confidence=${scanned.confidence}`);
}

// ── Test 8: Fallback → TMP-* (partNumber="" post-parse) ──
function testFallbackGeneratesProvisional() {
  console.log("\n=== Test 8: Fallback → TMP-* provisional ===");

  // Scenario A: fallback with DB match — partNumber="", subcategory filled, fallback notes
  let result = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "Schneider - Contactor",
      subcategory: "Contactor",
      categoryName: "อุปกรณ์ไฟฟ้า",
      confidence: 0.55,
      notes:
        "AI อ่านรูปไม่สำเร็จ ระบบเติมข้อมูลตั้งต้นจากรูปอะไหล่ใน DB ที่คล้ายที่สุด (LC1D09) กรุณาตรวจสอบก่อนบันทึก",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `fallback with DB match: partNumber is TMP-* (got "${result.partNumber}")`,
  );
  assert(
    result.partNumber.startsWith("TMP-CON-"),
    `fallback with DB match: partNumber is TMP-CON-* (got "${result.partNumber}")`,
  );
  assert(
    result.partName === "Schneider - Contactor",
    `fallback with DB match: partName preserved (got "${result.partName}")`,
  );
  assert(
    !result.partNumber.includes("LC1D09"),
    `fallback with DB match: partNumber does NOT use DB part number (got "${result.partNumber}")`,
  );

  // Scenario B: fallback without DB match — partNumber="", subcategory="", generic fallback notes
  result = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "",
      subcategory: "",
      categoryName: "",
      confidence: 0.2,
      notes:
        "AI อ่านรูปไม่สำเร็จ กรุณากรอกรหัส รุ่น และชื่ออะไหล่จากป้ายบนอุปกรณ์ก่อนบันทึก",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `fallback no DB match: partNumber is TMP-* (got "${result.partNumber}")`,
  );
  assert(
    result.partNumber.startsWith("TMP-SPP-"),
    `fallback no DB match: partNumber is TMP-SPP-* (got "${result.partNumber}")`,
  );
  assert(
    result.partName === "Unknown - Spare Part",
    `fallback no DB match: partName ultimate fallback (got "${result.partName}")`,
  );
  assert(
    result.categoryName === "อะไหล่",
    `fallback no DB match: categoryName "อะไหล่" (got "${result.categoryName}")`,
  );
  assert(
    result.confidence === 0.2,
    `fallback no DB match: confidence preserved at 0.2 (got ${result.confidence})`,
  );
  assert(
    /รหัสชั่วคราว/.test(result.notes),
    `fallback no DB match: notes says partNumber is provisional (got "${result.notes}")`,
  );

  // Scenario C: fallback with DB match + scannedBarcode → barcode wins
  result = applyPostParseDefaults(
    mk({
      partNumber: "",
      partName: "Mitsubishi - Breaker",
      subcategory: "Breaker",
      categoryName: "อุปกรณ์ไฟฟ้า",
      confidence: 0.6,
      notes:
        "AI อ่านรูปไม่สำเร็จ ระบบเติมข้อมูลตั้งต้นจากรูปอะไหล่ใน DB ที่คล้ายที่สุด (MS132-16) กรุณาตรวจสอบก่อนบันทึก",
    }),
    "8859876543210",
  );
  assert(
    result.partNumber === "8859876543210",
    `fallback + scannedBarcode: barcode wins (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "fallback + scannedBarcode: NOT provisional",
  );
}

// ── Test 9: partNumberConfidence guard + OCR uncertainty ──
function testPartNumberUncertaintyGuard() {
  console.log("\n=== Test 9: partNumberConfidence + OCR uncertainty guard ===");

  // ── A: partNumberConfidence 0.84 (below 0.85 threshold) + no barcode → TMP-* ──
  let result = applyPostParseDefaults(
    mk({
      partNumber: "3RN1010-1CW00",
      partNumberConfidence: 0.84,
      subcategory: "Relay",
      notes: "label: Siemens 3RN1010, OCR: 3RN1010-1CW00",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `pnConf=0.84 + no barcode → TMP-* (got "${result.partNumber}")`,
  );
  assert(
    /AI อ่านรหัส/.test(result.notes),
    `pnConf=0.84: notes mention AI reading (got "${result.notes}")`,
  );
  assert(
    /ไม่ชัดเจน/.test(result.notes),
    `pnConf=0.84: notes mention unclear (got "${result.notes}")`,
  );
  assert(
    result.confidence <= 0.75,
    `pnConf=0.84: confidence capped ≤0.75 (got ${result.confidence})`,
  );

  // ── B: partNumberConfidence 0.84 + scannedBarcode → use barcode ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "3RN1010-1CW00",
      partNumberConfidence: 0.84,
      subcategory: "Relay",
      notes: "label: Siemens, OCR: 3RN1010-1CW00 uncertain",
    }),
    "8859876543210",
  );
  assert(
    result.partNumber === "8859876543210",
    `pnConf=0.84 + barcode → barcode wins (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "pnConf=0.84 + barcode: NOT provisional",
  );
  assert(
    /ใช้รหัสจาก Barcode/.test(result.notes),
    `pnConf=0.84 + barcode: notes mention using barcode (got "${result.notes}")`,
  );

  // ── C: notes "OCR: uncertain / blurry" → uncertain, even with null partNumberConfidence ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "3RN1010",
      subcategory: "Relay",
      notes: "OCR: 3RN1010 but small text, uncertain / blurry, visual: thermal overload relay",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `notes "OCR: uncertain/blurry" → TMP-* (got "${result.partNumber}")`,
  );
  assert(
    /ไม่ชัดเจน/.test(result.notes),
    `notes: mentions unclear (got "${result.notes}")`,
  );

  // ── D: notes "partially readable" → uncertain → TMP-* ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "XYZ99",
      subcategory: "Sensor",
      notes: "label: partially readable, model XYZ99, visual: proximity sensor M18",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `notes "partially readable" → TMP-* (got "${result.partNumber}")`,
  );

  // ── E: notes "not fully readable" + scannedBarcode → barcode wins ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "GUESS456",
      partNumberConfidence: 0.6,
      subcategory: "Breaker",
      notes: "label: not fully readable, OCR: GUESS456, visual: MCB 2P",
    }),
    "8851234567890",
  );
  assert(
    result.partNumber === "8851234567890",
    `notes "not fully readable" + barcode → barcode (got "${result.partNumber}")`,
  );

  // ── F: notes "faint text" → uncertain → TMP-* ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "READ789",
      subcategory: "Contactor",
      notes: "OCR: READ789, label: faint text on worn nameplate, visual: contactor 3P",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `notes "faint text" → TMP-* (got "${result.partNumber}")`,
  );

  // ── G: notes "damaged label" → uncertain → TMP-* ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "DAMAGE1",
      subcategory: "Terminal Block",
      notes: "visual: terminal block 12-pole, label: damaged, OCR: DAMAGE1",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `notes "damaged" → TMP-* (got "${result.partNumber}")`,
  );

  // ── H: partNumberConfidence=0.9 + positive label → keep real partNumber ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "3RN2010-1CW30",
      partNumberConfidence: 0.92,
      subcategory: "Relay",
      notes: "label: Siemens 3RN2010-1CW30 clearly readable, visual: thermal overload relay 3-pole",
    }),
    null,
  );
  assert(
    result.partNumber === "3RN2010-1CW30",
    `pnConf=0.92 + clear label → keep pn (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "pnConf=0.92: NOT provisional",
  );
  assert(
    !/รหัสชั่วคราว/.test(result.notes),
    `pnConf=0.92: notes do NOT say provisional (got "${result.notes}")`,
  );

  // ── I: partNumberConfidence=0.85 (boundary — >= 0.85 is confident) → keep ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "LC1D09M7",
      partNumberConfidence: 0.85,
      subcategory: "Contactor",
      notes: "label: Schneider Electric LC1D09M7, visual: contactor TeSys D 3P",
    }),
    null,
  );
  assert(
    result.partNumber === "LC1D09M7",
    `pnConf=0.85 boundary → keep pn (got "${result.partNumber}")`,
  );
  assert(
    !isProvisional(result.partNumber),
    "pnConf=0.85 boundary: NOT provisional",
  );

  // ── J: partNumberCandidates preserved in notes for human review ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "",
      partNumberCandidates: ["3RN2010-1CW30", "3RN1010-1CW00"],
      partNumberConfidence: 0.45,
      uncertainPartNumberChars: ["char3: 0 or O", "char7: 1 or I"],
      subcategory: "Relay",
      notes: "OCR: ambiguous characters, visual: thermal overload relay",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    "candidates case: TMP-* generated",
  );
  assert(
    /candidates=\[3RN2010-1CW30, 3RN1010-1CW00\]/.test(result.notes),
    `candidates preserved in notes (got "${result.notes}")`,
  );
  assert(
    /uncertainChars=/.test(result.notes),
    `uncertainChars preserved in notes (got "${result.notes}")`,
  );
  assert(
    /char3: 0 or O/.test(result.notes),
    `uncertainChars detail preserved (got "${result.notes}")`,
  );

  // ── K: partNumberCandidates preserved even when pn kept (clear evidence) ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "LC1D09M7",
      partNumberCandidates: ["LC1D09"],
      partNumberConfidence: 0.95,
      uncertainPartNumberChars: [],
      subcategory: "Contactor",
      notes: "label: Schneider Electric LC1D09M7, visual: contactor 3P",
    }),
    null,
  );
  assert(
    result.partNumber === "LC1D09M7",
    "candidates + high conf: pn kept",
  );
  assert(
    /candidates=\[LC1D09\]/.test(result.notes),
    `candidates preserved even when pn kept (got "${result.notes}")`,
  );

  // ── L: Old behavior still works — null partNumberConfidence + clean notes ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "ABC123",
      subcategory: "Contactor",
      notes: "visual: 3-pole contactor",
      partNumberConfidence: null,
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    `null pnConf + no evidence → TMP-* (old behavior preserved, got "${result.partNumber}")`,
  );

  // ── M: partNumber="" with candidates is still provisional (no change) ──
  result = applyPostParseDefaults(
    mk({
      partNumber: "",
      partNumberCandidates: ["SOME-MODEL"],
      subcategory: "Motor",
      notes: "visual: motor 3-phase",
    }),
    null,
  );
  assert(
    isProvisional(result.partNumber),
    "empty pn + candidates → TMP-*",
  );
  assert(
    /candidates=\[SOME-MODEL\]/.test(result.notes),
    `candidates preserved with empty pn (got "${result.notes}")`,
  );
}

// ── run ──
function main() {
  console.log("🔍 Part-AI Post-Parse Defaults Tests");
  console.log("=====================================");

  testPartNumberPolicy();
  testProvisionalFormat();
  testPositivePartNumberEvidence();
  testNegativeEvidenceGeneratesProvisional();
  testPartNameDefaults();
  testCategoryNameDefaults();
  testMinQtyDefaults();
  testScannedBarcodePartNumber();
  testUnitDefault();
  testConfidenceZero();
  testNoLabelScenarios();
  testFallbackGeneratesProvisional();
  testPartNumberUncertaintyGuard();

  console.log("\n=====================================");
  if (failures === 0) {
    console.log("🎉 All tests passed!");
  } else {
    console.log(`❌ ${failures} test(s) failed`);
    process.exit(1);
  }
}

main();
