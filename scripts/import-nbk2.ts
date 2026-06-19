import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import ExcelJS from "exceljs";
import path from "path";

const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
const prisma = new PrismaClient({ adapter });

// NBK2 data - manually extracted and enriched with System, Type, and Material Description
// Format follows tem.xlsx: No. | Plant | System | Type | Material Description | Location | Unit | Stock On Hand | Picture
// Type = partNumber (model), Material Description = partName + full description
// Block = 2, Building = ท.021

const NBK2_DATA = [
  { partNo: "IRDH275B-435", system: "Insulation Monitor", type: "Insulation Monitor", desc: "Insulation monitoring device", matDesc: "IRDH275B-435 - Bender - Insulation Monitor - Bender IRDH275B-435 insulation monitoring device, ใช้ตรวจสอบฉนวนในระบบไฟฟ้า IT ไม่มีสายนอล (ungrounded), รองรับ AC/DC system, ใช้กับระบบจำหน่ายไฟฟ้าที่ต้องการติดตามค่าฉนวนแบบต่อเนื่อง", qty: 1 },
  { partNo: "IRDH275-427", system: "Insulation Monitor", type: "Insulation Monitor", desc: "Insulation monitoring", matDesc: "IRDH275-427 - Bender - Insulation Monitor - Bender IRDH275-427 insulation monitoring device, ใช้ตรวจสอบฉนวนในระบบไฟฟ้า IT ไม่มีสายนอล (ungrounded), รุ่น IRDH275 series, ใช้กับระบบจำหน่ายไฟฟ้าที่ต้องการติดตามค่าฉนวน", qty: 1 },
  { partNo: "7PA22410", system: "Relay", type: "Lockout Relay", desc: "Lockout fast relay", matDesc: "7PA22410 - ABB - Lockout Fast Relay - ABB 7PA22410 lockout fast relay, ใช้ล็อค/ป้องกันการเปิดวงจรซ้ำหลังเกิด fault (trip-lock), ใช้กับระบบป้องกันรีเลย์และ trip circuit ใน switchgear/switchboard", qty: 1 },
  { partNo: "7PA22510", system: "Relay", type: "Lockout Relay", desc: "Lockout fast relay", matDesc: "7PA22510 - ABB - Lockout Fast Relay - ABB 7PA22510 lockout fast relay, ใช้ล็อค/ป้องกันการเปิดวงจรซ้ำหลังเกิด fault (trip-lock), รุ่นต่างจาก 7PA22410, ใช้กับระบบป้องกันรีเลย์และ trip circuit ใน switchgear/switchboard", qty: 1 },
  { partNo: "AC-22B", system: "Fuse", type: "Fuse Disconnector", desc: "Fuse disconnector", matDesc: "AC-22B - ABB - Fuse Disconnector - ABB AC-22B fuse disconnector, ใช้ตัด/เชื่อมวงจรผ่านฟิวส์แบบ load-break, รองรับการดึงฟิวส์ภายใต้โหลด, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board) และ switchboard", qty: 60 },
  { partNo: "7XP9010-1", system: "Relay Socket", type: "Flush Mounting Socket", desc: "Flush mounting socket", matDesc: "7XP9010-1 - ABB - Flush Mounting Socket - ABB 7XP9010-1 flush mounting socket, ใช้ติดตั้งรีเลย์แบบฝัง (flush mount), รองรับรีเลย์อุตสาหกรรมแบบ plug-in, ใช้กับแผงควบคุม (control panel)", qty: 4 },
  { partNo: "PRS21N01BH", system: "Relay", type: "Auxiliary Relay", desc: "Auxiliary Relay", matDesc: "PRS21N01BH - ABB - Auxiliary Relay - ABB PRS21N01BH auxiliary relay, ใช้ขยาย contact หรือสัญญาณควบคุมในวงจรไฟฟ้า, ใช้กับระบบควบคุมและ interlocking ใน switchgear/switchboard", qty: 2 },
  { partNo: "A9A26919", system: "Relay", type: "Auxiliary Contact / Fault Relay", desc: "Auxiliary Contact / Fault", matDesc: "A9A26919 - ABB - Auxiliary Contact / Fault Signalling Relay - ABB A9A26919 auxiliary contact block / fault signalling relay, ใช้แสดงสถานะ fault/trip ของ circuit breaker, ติดตั้งภายในเบรกเกอร์หรือ accessories mounting, ใช้กับ ABB S200/Tmax series", qty: 7 },
  { partNo: "611", system: "Relay", type: "Industrial Plug-in Relay", desc: "Industrial Plug-in Relay D-R", matDesc: "611 - ABB - Industrial Plug-in Relay D-R Series - ABB รีเลย์อุตสาหกรรมแบบ plug-in รุ่น D-R series, หมายเลข 611, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket", qty: 3 },
  { partNo: "1029", system: "Relay", type: "Industrial Plug-in Relay", desc: "Industrial Plug-in Relay D", matDesc: "1029 - ABB - Industrial Plug-in Relay D Series - ABB รีเลย์อุตสาหกรรมแบบ plug-in รุ่น D series, หมายเลข 1029, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket", qty: 3 },
  { partNo: "RS-NBK2-001", system: "Relay Socket", type: "Relay Socket", desc: "Relay Socket", matDesc: "Relay Socket - ฐานรีเลย์ (Relay Socket) สำหรับติดตั้งรีเลย์อุตสาหกรรมแบบ plug-in, ใช้กับแผงควบคุม (control panel), รองรับ DIN Rail mounting", qty: 6 },
  { partNo: "A038302", system: "Circuit Breaker Accessory", type: "Shunt Trip", desc: "Shunt Trip", matDesc: "A038302 - ABB - Shunt Trip Unit - ABB A038302 shunt trip unit, ใช้ตัดวงจรเบรกเกอร์แบบระยะไกลผ่านสัญญาณไฟฟ้า (remote tripping), ใช้กับ ABB circuit breaker รุ่น S200/Tmax series", qty: 24 },
  { partNo: "RA4088/801", system: "Current Transformer", type: "Zero Sequence Current Transformer", desc: "Zero sequence current transformer", matDesc: "RA4088/801 - ABB - Zero Sequence Current Transformer (ZSCT) - ABB RA4088/801 zero sequence current transformer, ใช้ตรวจจับกระแสรั่ว (leakage current) ในระบบ 3 เฟส, ใช้กับระบบป้องกัน earth leakage/ground fault", qty: 4 },
  { partNo: "SG1501446-016", system: "Heater", type: "Space Heater", desc: "Space heater", matDesc: "SG1501446-016 - ABB - Space Heater - ABB SG1501446-016 space heater, ใช้ทำความร้อนใน switchboard/enclosure เพื่อป้องกันความชื้นและ condensation, ใช้กับแผงจำหน่ายไฟฟ้าที่ติดตั้งในสภาพแวดล้อมชื้น", qty: 2 },
  { partNo: "2CSF423005D1002", system: "Relay", type: "Residual Current Relay", desc: "Residual Current Relay", matDesc: "2CSF423005D1002 - ABB - Residual Current Relay (RCM/RCD) - ABB 2CSF423005D1002 residual current relay, ใช้ตรวจจับและตัดวงจรกรณีกระแสรั่ว (earth leakage), ใช้กับระบบป้องกัน earth leakage protection", qty: 20 },
  { partNo: "A038327", system: "Circuit Breaker Accessory", type: "Auxiliary Contact in Position", desc: "Auxiliary contact in position", matDesc: "A038327 - ABB - Auxiliary Contact in Position - ABB A038327 auxiliary contact in position, ใช้แสดงสถานะตำแหน่ง (ON/OFF/tripped) ของ circuit breaker, ติดตั้งภายในเบรกเกอร์, ใช้กับ ABB S200/Tmax series", qty: 4 },
  { partNo: "Lot.0159", system: "Current Transformer", type: "Residual Current Transformer", desc: "Residual current transformer", matDesc: "Lot.0159 - Residual Current Transformer (RC Core) - Residual current transformer (core balance) หมายเลข Lot.0159, ใช้ตรวจจับกระแสรั่วร่วมกับ residual current relay, ใช้กับระบบ earth leakage protection", qty: 15 },
  { partNo: "RCT-NBK2-001", system: "Current Transformer", type: "Residual Current Transformer", desc: "Residual current transformer", matDesc: "Residual Current Transformer (RC Core) - หมอแปลงกระแสรั่ว (core balance type), ใช้ตรวจจับกระแสรั่วร่วมกับ residual current relay, ใช้กับระบบ earth leakage protection", qty: 1 },
  { partNo: "1025", system: "Relay", type: "Industrial Relay", desc: "Industrial Relay", matDesc: "1025 - ABB - Industrial Relay - ABB รีเลย์อุตสาหกรรม หมายเลข 1025, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket แบบ plug-in", qty: 4 },
  { partNo: "CS30323", system: "Miniature Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker", matDesc: "CS30323 - ABB - Miniature Circuit Breaker (MCB) - ABB CS30323 miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty: 7 },
  { partNo: "12D9", system: "Contactor", type: "Magnetic Contactor", desc: "Magnetic contactor", matDesc: "12D9 - ABB - Magnetic Contactor - ABB 12D9 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล (remote switching), ใช้ควบคุมมอเตอร์, แสงสว่าง, หรือโหลดอื่น ๆ, ติดตั้งบน DIN rail", qty: 2 },
  { partNo: "H3CR", system: "Timer", type: "Analog Timer", desc: "Analog timer", matDesc: "H3CR - Omron - Analog Timer - Omron H3CR analog timer relay, ใช้ตั้งเวลา delay ในวงจรควบคุม (on-delay / off-delay / interval), ใช้กับระบบอัตโนมัติและ control panel, มีช่วงเวลาตั้งแต่ 0.05 วินาที ถึง 12 ชั่วโมง", qty: 13 },
  { partNo: "RF4XR", system: "Relay", type: "Auxiliary Relay", desc: "Auxiliary Relay", matDesc: "RF4XR - ABB - Auxiliary Relay - ABB RF4XR auxiliary relay, 4 changeover contacts, ใช้ขยาย contact หรือสัญญาณควบคุมในวงจรไฟฟ้า, ใช้กับระบบควบคุมและ interlocking ใน switchgear/switchboard", qty: 3 },
  { partNo: "05199554C", system: "Current Transformer", type: "Current Transformer (CT)", desc: "Current Transformer (CT)", matDesc: "05199554C - ABB - Current Transformer (CT) - ABB 05199554C current transformer, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty: 1 },
  { partNo: "2CDS273001R0064", system: "Miniature Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker", matDesc: "2CDS273001R0064 - ABB - Miniature Circuit Breaker (MCB) - ABB 2CDS273001R0064 miniature circuit breaker, System Pro M compact, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty: 1 },
  { partNo: "GM-MCSC1000SM", system: "Network Equipment", type: "Fast Ethernet Converter", desc: "Fast Ethernet Converter", matDesc: "GM-MCSC1000SM - Korenix - Fast Ethernet Media Converter - Korenix (Beijer) GM-MCSC1000SM fast Ethernet media converter, แปลงสัญญาณระหว่าง copper (RJ45) กับ fiber optic, ใช้กับระบบเครือข่ายอุตสาหกรรม, รองรับ 100Mbps Fast Ethernet", qty: 4 },
  { partNo: "ACVT03", system: "Network Equipment", type: "Gigabit Fiber Media Converter", desc: "Gigabit fiber Media Converter", matDesc: "ACVT03 - ABB - Gigabit Fiber Media Converter - ABB ACVT03 gigabit fiber media converter, แปลงสัญญาณระหว่าง copper (RJ45) กับ fiber optic ความเร็ว 1Gbps, ใช้กับระบบเครือข่ายอุตสาหกรรมและ SCADA/automation", qty: 8 },
  { partNo: "3300/078", system: "Power Meter", type: "Digital Power Meter", desc: "Digital power meter", matDesc: "3300/078 - ABB - Digital Power Meter - ABB 3300/078 digital power meter, ใช้วัดค่าไฟฟ้า (V, A, W, VA, var, PF, Hz, kWh) ในระบบจำหน่ายไฟฟ้า, ติดตั้งบน switchboard/panel, ใช้กับระบบ monitoring และ energy management", qty: 1 },
  { partNo: "YSBPL2-AL11", system: "Pilot Light", type: "Pilot Lamp", desc: "Pilot Lamp", matDesc: "YSBPL2-AL11 - ABB - Pilot Lamp - ABB YSBPL2-AL11 pilot lamp, ใช้แสดงสถานะวงจรไฟฟ้า (ON/OFF/ALARM), ติดตั้งบน control panel แบบ flush mount, ใช้กับระบบแสดงสถานะและสัญญาณเตือน", qty: 9 },
  { partNo: "YSBRL34-DL22", system: "Pilot Light", type: "Square Pilot Light", desc: "Square Pilot Light", matDesc: "YSBRL34-DL22 - ABB - Square Pilot Light - ABB YSBRL34-DL22 square pilot light, ใช้แสดงสถานะวงจรไฟฟ้า (ON/OFF/ALARM) แบบทรงสี่เหลี่ยม, ติดตั้งบน control panel, ใช้กับระบบแสดงสถานะและสัญญาณเตือน", qty: 3 },
  { partNo: "CT30", system: "Current Transformer", type: "Current Transformer (CT)", desc: "Current Transformer (CT)", matDesc: "CT30 - ABB - Current Transformer (CT) - ABB CT30 current transformer, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, รองรับกระแส rated 30A, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty: 2 },
  { partNo: "4121041062", system: "Terminal Block", type: "Terminal Block (4 pole)", desc: "Terminal Block (4 pole)", matDesc: "4121041062 - ABB - Terminal Block 4 Pole - ABB 4121041062 terminal block 4 pole, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, 4 ขั้วต่อบล็อก", qty: 1 },
  { partNo: "4121061203", system: "Terminal Block", type: "Terminal Block (2 pole)", desc: "Terminal Block (2 pole)", matDesc: "4121061203 - ABB - Terminal Block 2 Pole - ABB 4121061203 terminal block 2 pole, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, 2 ขั้วต่อบล็อก", qty: 1 },
  { partNo: "RF4", system: "Relay", type: "Protective Relay", desc: "Protective Relay", matDesc: "RF4 - ABB - Protective Relay - ABB RF4 protective relay, 4 changeover contacts, ใช้ป้องกันและควบคุมวงจรไฟฟ้าในระบบ switchgear, ใช้กับระบบ interlocking และ protection scheme", qty: 18 },
  { partNo: "RD2DI", system: "Relay", type: "Interface Relay", desc: "Interface Relay", matDesc: "RD2DI - ABB - Interface Relay - ABB RD2DI interface relay, 2 changeover contacts, ใช้แปลงสัญญาณระหว่างระบบควบคุมกับวงจรกำลัง (interface/isolation), ติดตั้งบน DIN rail", qty: 4 },
  { partNo: "3ZX10-12-0RH11-1AA1", system: "Contactor", type: "Contactor + Auxiliary Contact", desc: "Contactor + Auxiliary contact", matDesc: "3ZX10-12-0RH11-1AA1 - Siemens - Contactor + Auxiliary Contact - Siemens 3ZX10-12-0RH11-1AA1 contactor พร้อม auxiliary contact, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, ติดตั้งบน DIN rail", qty: 3 },
];

async function main() {
  console.log("=== Step 1: Create Building ท.021 ===");
  const building = await prisma.building.upsert({
    where: { name: "ท.021" },
    update: {},
    create: { name: "ท.021", sortOrder: 21, isActive: true },
  });
  console.log("Building:", building.id, building.name);

  console.log("\n=== Step 2: Create Categories from System values ===");
  const systemValues = [...new Set(NBK2_DATA.map(d => d.system))];
  const categoryMap: Record<string, string> = {};
  for (const sys of systemValues) {
    const cat = await prisma.category.upsert({
      where: { name: sys },
      update: {},
      create: { name: sys },
    });
    categoryMap[sys] = cat.id;
    console.log("  Category:", cat.name, "->", cat.id);
  }

  console.log("\n=== Step 3: Import parts ===");
  let created = 0;
  let skipped = 0;

  for (const item of NBK2_DATA) {
    const existing = await prisma.part.findUnique({ where: { partNumber: item.partNo } });
    if (existing) {
      console.log(`  SKIP (exists): ${item.partNo}`);
      skipped++;
      continue;
    }

    const part = await prisma.part.create({
      data: {
        partNumber: item.partNo,
        partName: item.type,
        description: item.matDesc,
        categoryId: categoryMap[item.system],
        buildingId: building.id,
        subcategory: item.system,
        location: "Block 2",
        quantity: item.qty,
        minimumQuantity: 0,
        unit: "pcs",
        isActive: true,
      },
    });
    console.log(`  CREATED: ${part.partNumber} - ${part.partName} (qty: ${part.quantity})`);
    created++;
  }

  console.log(`\n=== Done: ${created} created, ${skipped} skipped ===`);

  // Verify
  const totalParts = await prisma.part.count();
  const partsInBuilding = await prisma.part.count({ where: { buildingId: building.id } });
  console.log(`Total parts in DB: ${totalParts}`);
  console.log(`Parts in ท.021: ${partsInBuilding}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
