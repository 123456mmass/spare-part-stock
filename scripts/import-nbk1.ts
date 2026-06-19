import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
const prisma = new PrismaClient({ adapter });

// NBK1 data - extracted from NBK1.xlsx
// Duplicates merged: LRD21 (2), LV429674 (2), LV429676 (2), LV430672 (2), LV430671 (2), LV429677 (2+2=4)
// Row numbers are Excel row numbers (row 2 = first data row)
// plant = "1" (Block 1), Building = ท.021

const NBK1_DATA = [
  { row: 2, partNo: "LRD21", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD21 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD21 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 12-18A, ใช้กับ contactor รุ่น LC1-D25/D38, ติดตั้งด้านล่าง contactor โดยตรง", qty: 2 },
  { row: 3, partNo: "LADN22", system: "Contact Block", type: "Contact Block", desc: "Auxiliary contact block", matDesc: "LADN22 - Schneider Electric - Auxiliary Contact Block - Schneider Electric LADN22 auxiliary contact block, 2NO+2NC, ใช้ขยาย contact ของ contactor, ติดตั้งด้านข้าง contactor LC1-D series, ใช้กับระบบควบคุมและ interlocking", qty: 7 },
  { row: 4, partNo: "LRD16", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD16 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD16 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 5.5-8A, ใช้กับ contactor รุ่น LC1-D18/D25, ติดตั้งด้านล่าง contactor โดยตรง", qty: 4 },
  { row: 5, partNo: "LRD14", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD14 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD14 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 3.5-5A, ใช้กับ contactor รุ่น LC1-D12/D18, ติดตั้งด้านล่าง contactor โดยตรง", qty: 2 },
  { row: 6, partNo: "LRD3361", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD3361 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD3361 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 1.3-1.8A, ใช้กับ contactor รุ่น LC1-D09/D12, class 10A, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 7, partNo: "LA7D1064", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LA7D1064 - Schneider Electric - Thermal Overload Relay - Schneider Electric LA7D1064 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ใช้กับ contactor รุ่น LC1-D40/D50/D65, class 10, ติดตั้งด้านล่าง contactor โดยตรง", qty: 2 },
  { row: 8, partNo: "LAD7B106", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LAD7B106 - Schneider Electric - Thermal Overload Relay - Schneider Electric LAD7B106 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ใช้กับ contactor รุ่น LC1-D80/D95, class 10, ติดตั้งด้านล่าง contactor โดยตรง", qty: 4 },
  { row: 9, partNo: "GV2P16", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P16 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P16 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 9-14A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 1 },
  { row: 10, partNo: "LRD12", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD12 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD12 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 2-3.5A, ใช้กับ contactor รุ่น LC1-D09, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 11, partNo: "LV438018", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV438018 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV438018 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 12, partNo: "LV429674", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429674 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429674 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 13, partNo: "EZC250H3250", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "EZC250H3250 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC250H3250 molded case circuit breaker, EasyPact TVS series, 250A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 3 },
  { row: 14, partNo: "LC1 D80P7", system: "Contactor", type: "Power Contactor", desc: "Power contactor", matDesc: "LC1 D80P7 - Schneider Electric - Power Contactor - Schneider Electric LC1D80P7 power contactor, 80A 3P, coil 220V 50Hz/240V 60Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์ขนาดใหญ่และโหลดอุตสาหกรรม, TeSys D series", qty: 1 },
  { row: 15, partNo: "LV429337", system: "Circuit Breaker Accessory", type: "Rotary Handle", desc: "Rotary handle for MCCB", matDesc: "LV429337 - Schneider Electric - Rotary Handle - Schneider Electric LV429337 rotary handle, ใช้สวิตช์/ตัดวงจร MCCB แบบหมุน (rotary operator), ติดตั้งบนหน้าประตู switchboard, ใช้กับ Compact NSX series", qty: 1 },
  { row: 16, partNo: "LV429672", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429672 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429672 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 17, partNo: "LV429674-P", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429674-P - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429674-P molded case circuit breaker, Compact NSX series (plug-in version), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 18, partNo: "LV429670-P", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429670-P - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429670-P molded case circuit breaker, Compact NSX series (plug-in version), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 19, partNo: "LV438218", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV438218 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV438218 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 20, partNo: "LV429676", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429676 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429676 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 21, partNo: "LV430672", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV430672 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430672 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 22, partNo: "LV430670", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV430670 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430670 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 23, partNo: "LV430671", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV430671 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430671 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 24, partNo: "LV429677", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV429677 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429677 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 4 },
  { row: 25, partNo: "LV431630", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV431630 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV431630 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 1 },
  { row: 26, partNo: "LV431670", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV431670 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV431670 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 3 },
  { row: 27, partNo: "LC1D40AP7", system: "Contactor", type: "Power Contactor", desc: "Power contactor", matDesc: "LC1D40AP7 - Schneider Electric - Power Contactor - Schneider Electric LC1D40AP7 power contactor, 40A 3P, coil 220V 50Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, TeSys D series", qty: 1 },
  { row: 28, partNo: "LC1 D40M7", system: "Contactor", type: "Power Contactor", desc: "Power contactor", matDesc: "LC1D40M7 - Schneider Electric - Power Contactor - Schneider Electric LC1D40M7 power contactor, 40A 3P, coil 220V 50Hz/240V 60Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, TeSys D series", qty: 1 },
  { row: 29, partNo: "EZC100H3020", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "EZC100H3020 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC100H3020 molded case circuit breaker, EasyPact TVS series, 100A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 30, partNo: "GV2 P14", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P14 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P14 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 6-10A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 5 },
  { row: 31, partNo: "EZC100H3015", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "EZC100H3015 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC100H3015 molded case circuit breaker, EasyPact TVS series, 100A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 0 },
  { row: 32, partNo: "GV2 P16", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P16 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P16 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 9-14A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 1 },
  { row: 33, partNo: "GV2 P20", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P20 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P20 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 13-18A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 0 },
  { row: 34, partNo: "LRD340", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD340 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD340 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D40/D50, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 35, partNo: "LRD4369", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD4369 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD4369 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D65, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 36, partNo: "LA7D3064", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LA7D3064 - Schneider Electric - Thermal Overload Relay - Schneider Electric LA7D3064 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D80/D95, ติดตั้งด้านล่าง contactor โดยตรง", qty: 2 },
  { row: 37, partNo: "LRD3359", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD3359 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD3359 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D25/D38, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 38, partNo: "LRD332", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD332 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD332 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D18/D25, ติดตั้งด้านล่าง contactor โดยตรง", qty: 4 },
  { row: 39, partNo: "GV2 P21", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P21 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P21 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 17-23A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 1 },
  { row: 40, partNo: "DE-96", system: "Power Meter", type: "Panel Meter", desc: "Digital panel meter", matDesc: "DE-96 - Digital Panel Meter - มิเตอร์แสดงค่าไฟฟ้าแบบดิจิทัล ขนาด 96x96mm, ใช้วัดค่าไฟฟ้า (V, A, W, PF, Hz) ในระบบจำหน่ายไฟฟ้า, ติดตั้งบน switchboard/panel", qty: 2 },
  { row: 41, partNo: "LRD32", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD32 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD32 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D18, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 42, partNo: "GV2 P22", system: "Circuit Breaker", type: "Motor Protection Circuit Breaker", desc: "Motor protection circuit breaker (MPCB)", matDesc: "GV2P22 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P22 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 20-25A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty: 1 },
  { row: 43, partNo: "LRD08", system: "Relay", type: "Thermal Relay", desc: "Thermal overload relay", matDesc: "LRD08 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD08 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 2.5-4A, ใช้กับ contactor รุ่น LC1-D09, ติดตั้งด้านล่าง contactor โดยตรง", qty: 1 },
  { row: 44, partNo: "LV432695", system: "Circuit Breaker", type: "Molded Case Circuit Breaker", desc: "Molded case circuit breaker (MCCB)", matDesc: "LV432695 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV432695 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty: 2 },
  { row: 45, partNo: "TU2ba", system: "Current Transformer", type: "Current Transformer", desc: "Current transformer (CT)", matDesc: "TU2ba - Current Transformer (CT) - หม้อแปลงกระแส TU2ba, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty: 1 },
  { row: 46, partNo: "LC1F330", system: "Contactor", type: "Magnetic Contactor", desc: "Magnetic contactor", matDesc: "LC1F330 - Schneider Electric - Magnetic Contactor - Schneider Electric LC1F330 magnetic contactor, 300A 3P, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์ขนาดใหญ่และโหลดอุตสาหกรรม, TeSys F series", qty: 1 },
  { row: 47, partNo: "BQ005959", system: "Transducer", type: "Watt Transducer", desc: "Watt transducer", matDesc: "BQ005959 - Schneider Electric - Watt Transducer - Schneider Electric BQ005959 watt transducer, ใช้แปลงสัญญาณกำลังไฟฟ้า (W) เป็นสัญญาณมาตรฐาน (4-20mA/0-10V) สำหรับ SCADA/PLC, ใช้กับระบบ monitoring พลังงานไฟฟ้า", qty: 1 },
  { row: 48, partNo: "SD-N21", system: "Contactor", type: "Magnetic Contactor", desc: "Magnetic contactor", matDesc: "SD-N21 - LS Electric - Magnetic Contactor - LS Electric SD-N21 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, Metasol series", qty: 2 },
  { row: 49, partNo: "SD-N11", system: "Contactor", type: "Magnetic Contactor", desc: "Magnetic contactor", matDesc: "SD-N11 - LS Electric - Magnetic Contactor - LS Electric SD-N11 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, Metasol series", qty: 1 },
  { row: 50, partNo: "NF32-SW", system: "Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker (MCB)", matDesc: "NF32-SW - LS Electric - Miniature Circuit Breaker (MCB) - LS Electric NF32-SW miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty: 5 },
  { row: 51, partNo: "A013247", system: "Contactor", type: "Magnetic Contactor", desc: "Magnetic contactor", matDesc: "A013247 - LS Electric - Magnetic Contactor - LS Electric A013247 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม", qty: 1 },
  { row: 52, partNo: "HMCP007C0C", system: "Circuit Breaker", type: "Motor Circuit Protector", desc: "Motor circuit protector (MCP)", matDesc: "HMCP007C0C - Hyundai - Motor Circuit Protector (MCP) - Hyundai HMCP007C0C motor circuit protector, ใช้ป้องกันมอเตอร์จาก short circuit, 7A rated, ใช้กับระบบควบคุมมอเตอร์, ติดตั้งในแผงควบคุม", qty: 1 },
  { row: 53, partNo: "NF125-SW", system: "Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker (MCB)", matDesc: "NF125-SW - LS Electric - Miniature Circuit Breaker (MCB) - LS Electric NF125-SW miniature circuit breaker, 125A, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty: 2 },
  { row: 54, partNo: "S100-GF", system: "Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker (MCB)", matDesc: "S100-GF - ABB - Miniature Circuit Breaker (MCB) - ABB S100-GF miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit, พร้อม earth leakage protection (GFCI/RCBO), ติดตั้งบน DIN rail", qty: 8 },
  { row: 55, partNo: "CT20 100/5A", system: "Current Transformer", type: "Current Transformer", desc: "Current transformer (CT)", matDesc: "CT20 100/5A - Current Transformer (CT) - หม้อแปลงกระแส อัตราส่วน 100/5A, ใช้ลดกระแสไฟฟ้าจาก 100A เป็น 5A สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty: 3 },
  { row: 56, partNo: "CT30 300/5A", system: "Current Transformer", type: "Current Transformer", desc: "Current transformer (CT)", matDesc: "CT30 300/5A - Current Transformer (CT) - หม้อแปลงกระแส อัตราส่วน 300/5A, ใช้ลดกระแสไฟฟ้าจาก 300A เป็น 5A สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty: 2 },
  { row: 57, partNo: "IEC/EN 60947-2", system: "Circuit Breaker", type: "Miniature Circuit Breaker", desc: "Miniature circuit breaker (MCB)", matDesc: "IEC/EN 60947-2 - Miniature Circuit Breaker (MCB) - เบรกเกอร์ขนาดเล็ก มาตรฐาน IEC/EN 60947-2, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า", qty: 2 },
  { row: 58, partNo: "XDI-BCOVER", system: "Terminal Block", type: "Terminal Plug Cover", desc: "Terminal plug cover", matDesc: "XDI-BCOVER - Terminal Plug Cover - ฝาครอบ/ปลั๊กปิดช่องว่างบน terminal block หรือ DIN rail, ใช้ป้องกันฝุ่นและการสัมผัสจุดต่อไฟฟ้า, ติดตั้งบนแผงควบคุม", qty: 1 },
  { row: 59, partNo: "SJ1725HA2", system: "Motor Protection", type: "Thermally Protected Device", desc: "Thermally protected device", matDesc: "SJ1725HA2 - Thermally Protected Device - อุปกรณ์ป้องกันความร้อน (thermal protector), ใช้ป้องกันมอเตอร์/อุปกรณ์ไฟฟ้าจากความร้อนเกิน, ตัดวงจรอัตโนมัติเมื่ออุณหภูมิเกินกำหนด", qty: 5 },
  { row: 60, partNo: "153640496", system: "Terminal Block", type: "DIN Rail Terminal Block", desc: "DIN rail terminal block", matDesc: "153640496 - Wago - DIN Rail Terminal Block - Wago 153640496 DIN rail terminal block, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, รองรับการต่อสายแบบ push-in/screw", qty: 4 },
  { row: 61, partNo: "103625710", system: "Terminal Block", type: "DIN Rail Terminal Block", desc: "DIN rail terminal block", matDesc: "103625710 - Wago - DIN Rail Terminal Block - Wago 103625710 DIN rail terminal block, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, รองรับการต่อสายแบบ push-in/screw", qty: 1 },
];

const UPLOADS_DIR = "/var/www/spare-part-stock/public/uploads/parts";
const IMAGES_DIR = "/root/nbk1_images"; // will upload here

async function main() {
  console.log("=== Step 1: Ensure Building ท.021 ===");
  const building = await prisma.building.upsert({
    where: { name: "ท.021" },
    update: {},
    create: { name: "ท.021", sortOrder: 21, isActive: true },
  });
  console.log("Building:", building.id, building.name);

  console.log("\n=== Step 2: Create/verify Categories ===");
  const systemValues = [...new Set(NBK1_DATA.map(d => d.system))];
  const categoryMap: Record<string, string> = {};
  for (const sys of systemValues) {
    const cat = await prisma.category.upsert({
      where: { name: sys },
      update: {},
      create: { name: sys },
    });
    categoryMap[sys] = cat.id;
  }
  console.log("Categories ready:", systemValues.length);

  console.log("\n=== Step 3: Import parts + images ===");
  let created = 0;
  let skipped = 0;

  for (const item of NBK1_DATA) {
    const existing = await prisma.part.findUnique({ where: { partNumber: item.partNo } });
    if (existing) {
      console.log(`  SKIP (exists): ${item.partNo}`);
      skipped++;
      continue;
    }

    // Create part with plant="1" (Block 1)
    const part = await prisma.part.create({
      data: {
        partNumber: item.partNo,
        partName: item.type,
        description: item.matDesc,
        categoryId: categoryMap[item.system],
        buildingId: building.id,
        subcategory: item.system,
        plant: "1",
        location: "Block 1",
        quantity: item.qty,
        minimumQuantity: 0,
        unit: "pcs",
        isActive: true,
      },
    });

    // Try to attach image
    const rowPadded = String(item.row).padStart(2, "0");
    const imgPath = path.join(IMAGES_DIR, `row_${rowPadded}.jpg`);
    let imageUrl: string | null = null;

    if (fs.existsSync(imgPath)) {
      const imgBuf = fs.readFileSync(imgPath);
      const hash = crypto.createHash("md5").update(imgBuf).digest("hex").slice(0, 8);
      const newFilename = `${part.id}-${hash}.jpg`;
      const newPath = path.join(UPLOADS_DIR, newFilename);
      fs.writeFileSync(newPath, imgBuf);
      imageUrl = `/uploads/parts/${newFilename}`;
      await prisma.part.update({ where: { id: part.id }, data: { imageUrl } });
    }

    console.log(`  CREATED: ${part.partNumber} - ${part.partName} (qty: ${part.quantity}) ${imageUrl ? '📷' : '❌'}`);
    created++;
  }

  console.log(`\n=== Done: ${created} created, ${skipped} skipped ===`);

  // Verify
  const partsInBuilding = await prisma.part.findMany({
    where: { buildingId: building.id },
    select: { partNumber: true, plant: true, imageUrl: true },
  });
  const block1 = partsInBuilding.filter(p => p.plant === "1");
  const block2 = partsInBuilding.filter(p => p.plant === "2");
  console.log(`Parts in ท.021: ${partsInBuilding.length} (Block 1: ${block1.length}, Block 2: ${block2.length})`);
  const withImg = partsInBuilding.filter(p => p.imageUrl).length;
  console.log(`With image: ${withImg}, Without: ${partsInBuilding.length - withImg}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
