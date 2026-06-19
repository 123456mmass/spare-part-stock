import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const adapter = new PrismaBetterSqlite3({ url: "dev.db" });
const prisma = new PrismaClient({ adapter });

const UPLOADS_DIR = "/var/www/spare-part-stock/public/uploads/parts";

// ===== NBK1: 66 items, Block 1 =====
// item 1 = row 2, item 66 = row 67
// Duplicate partNo gets suffix: LRD21 x2, LV429674 x2, etc.
const NBK1: { item: number; partNo: string; type: string; system: string; matDesc: string; qty: number }[] = [
  { item:1, partNo:"LRD21", type:"Thermal Relay", system:"Relay", matDesc:"LRD21 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD21 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 12-18A, ใช้กับ contactor รุ่น LC1-D25/D38, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:2, partNo:"LADN22", type:"Contact Block", system:"Contact Block", matDesc:"LADN22 - Schneider Electric - Auxiliary Contact Block - Schneider Electric LADN22 auxiliary contact block, 2NO+2NC, ใช้ขยาย contact ของ contactor, ติดตั้งด้านข้าง contactor LC1-D series, ใช้กับระบบควบคุมและ interlocking", qty:7 },
  { item:3, partNo:"LRD16", type:"Thermal Relay", system:"Relay", matDesc:"LRD16 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD16 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 5.5-8A, ใช้กับ contactor รุ่น LC1-D18/D25, ติดตั้งด้านล่าง contactor โดยตรง", qty:4 },
  { item:4, partNo:"LRD14", type:"Thermal Relay", system:"Relay", matDesc:"LRD14 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD14 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 3.5-5A, ใช้กับ contactor รุ่น LC1-D12/D18, ติดตั้งด้านล่าง contactor โดยตรง", qty:2 },
  { item:5, partNo:"LRD3361", type:"Thermal Relay", system:"Relay", matDesc:"LRD3361 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD3361 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 1.3-1.8A, ใช้กับ contactor รุ่น LC1-D09/D12, class 10A, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:6, partNo:"LA7D1064", type:"Thermal Relay", system:"Relay", matDesc:"LA7D1064 - Schneider Electric - Thermal Overload Relay - Schneider Electric LA7D1064 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ใช้กับ contactor รุ่น LC1-D40/D50/D65, class 10, ติดตั้งด้านล่าง contactor โดยตรง", qty:2 },
  { item:7, partNo:"LAD7B106", type:"Thermal Relay", system:"Relay", matDesc:"LAD7B106 - Schneider Electric - Thermal Overload Relay - Schneider Electric LAD7B106 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ใช้กับ contactor รุ่น LC1-D80/D95, class 10, ติดตั้งด้านล่าง contactor โดยตรง", qty:4 },
  { item:8, partNo:"GV2P16", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P16 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P16 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 9-14A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:1 },
  { item:9, partNo:"LRD12", type:"Thermal Relay", system:"Relay", matDesc:"LRD12 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD12 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 2-3.5A, ใช้กับ contactor รุ่น LC1-D09, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:10, partNo:"LV438018", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV438018 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV438018 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:11, partNo:"LV429674", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429674 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429674 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:12, partNo:"EZC250H3250", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"EZC250H3250 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC250H3250 molded case circuit breaker, EasyPact TVS series, 250A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty:3 },
  { item:13, partNo:"LC1D80P7", type:"Power Contactor", system:"Contactor", matDesc:"LC1D80P7 - Schneider Electric - Power Contactor - Schneider Electric LC1D80P7 power contactor, 80A 3P, coil 220V 50Hz/240V 60Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์ขนาดใหญ่และโหลดอุตสาหกรรม, TeSys D series", qty:1 },
  { item:14, partNo:"LV429337", type:"Rotary Handle", system:"Circuit Breaker Accessory", matDesc:"LV429337 - Schneider Electric - Rotary Handle - Schneider Electric LV429337 rotary handle, ใช้สวิตช์/ตัดวงจร MCCB แบบหมุน (rotary operator), ติดตั้งบนหน้าประตู switchboard, ใช้กับ Compact NSX series", qty:1 },
  { item:15, partNo:"LV429672", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429672 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429672 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:16, partNo:"LV429674-P", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429674-P - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429674-P molded case circuit breaker, Compact NSX series (plug-in version), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:17, partNo:"LV429670-P", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429670-P - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429670-P molded case circuit breaker, Compact NSX series (plug-in version), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:18, partNo:"LV438218", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV438218 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV438218 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:19, partNo:"LV429676", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429676 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429676 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:20, partNo:"LV430672", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV430672 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430672 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:21, partNo:"LV430670", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV430670 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430670 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:22, partNo:"LV430671", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV430671 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430671 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:23, partNo:"LV430672-2", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV430672 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430672 molded case circuit breaker, Compact NSX series (unit 2), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:24, partNo:"LV429677", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429677 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429677 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:25, partNo:"LV429677-2", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429677 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429677 molded case circuit breaker, Compact NSX series (unit 2), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:26, partNo:"LV429674-2", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429674 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429674 molded case circuit breaker, Compact NSX series (unit 2), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:27, partNo:"LV431630", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV431630 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV431630 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:28, partNo:"LV431670", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV431670 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV431670 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:3 },
  { item:29, partNo:"LV430671-2", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV430671 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV430671 molded case circuit breaker, Compact NSX series (unit 2), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:30, partNo:"LV429676-2", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV429676 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV429676 molded case circuit breaker, Compact NSX series (unit 2), ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:1 },
  { item:31, partNo:"LC1D40AP7", type:"Power Contactor", system:"Contactor", matDesc:"LC1D40AP7 - Schneider Electric - Power Contactor - Schneider Electric LC1D40AP7 power contactor, 40A 3P, coil 220V 50Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, TeSys D series", qty:1 },
  { item:32, partNo:"LC1D40M7", type:"Power Contactor", system:"Contactor", matDesc:"LC1D40M7 - Schneider Electric - Power Contactor - Schneider Electric LC1D40M7 power contactor, 40A 3P, coil 220V 50Hz/240V 60Hz, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, TeSys D series", qty:1 },
  { item:33, partNo:"EZC100H3020", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"EZC100H3020 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC100H3020 molded case circuit breaker, EasyPact TVS series, 100A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty:2 },
  { item:34, partNo:"GV2P14", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P14 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P14 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 6-10A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:5 },
  { item:35, partNo:"EZC100H3015", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"EZC100H3015 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric EZC100H3015 molded case circuit breaker, EasyPact TVS series, 100A 3P, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard, ใช้กับระบบจำหน่ายไฟฟ้า", qty:0 },
  { item:36, partNo:"GV2P16", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P16 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P16 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 9-14A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:1 },
  { item:37, partNo:"GV2P20", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P20 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P20 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 13-18A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:0 },
  { item:38, partNo:"LRD340", type:"Thermal Relay", system:"Relay", matDesc:"LRD340 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD340 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D40/D50, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:39, partNo:"LRD4369", type:"Thermal Relay", system:"Relay", matDesc:"LRD4369 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD4369 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D65, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:40, partNo:"LA7D3064", type:"Thermal Relay", system:"Relay", matDesc:"LA7D3064 - Schneider Electric - Thermal Overload Relay - Schneider Electric LA7D3064 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D80/D95, ติดตั้งด้านล่าง contactor โดยตรง", qty:2 },
  { item:41, partNo:"LRD3359", type:"Thermal Relay", system:"Relay", matDesc:"LRD3359 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD3359 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D25/D38, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:42, partNo:"LRD332", type:"Thermal Relay", system:"Relay", matDesc:"LRD332 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD332 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D18/D25, ติดตั้งด้านล่าง contactor โดยตรง", qty:4 },
  { item:43, partNo:"GV2P21", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P21 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P21 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 17-23A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:1 },
  { item:44, partNo:"DE-96", type:"Panel Meter", system:"Power Meter", matDesc:"DE-96 - Digital Panel Meter - มิเตอร์แสดงค่าไฟฟ้าแบบดิจิทัล ขนาด 96x96mm, ใช้วัดค่าไฟฟ้า (V, A, W, PF, Hz) ในระบบจำหน่ายไฟฟ้า, ติดตั้งบน switchboard/panel", qty:2 },
  { item:45, partNo:"LRD32", type:"Thermal Relay", system:"Relay", matDesc:"LRD32 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD32 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), class 10, ใช้กับ contactor รุ่น LC1-D18, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:46, partNo:"GV2P22", type:"Motor Protection Circuit Breaker", system:"Circuit Breaker", matDesc:"GV2P22 - Schneider Electric - Motor Protection Circuit Breaker (MPCB) - Schneider Electric GV2P22 motor protection circuit breaker, ใช้ป้องกันมอเตอร์จาก short circuit และ overload, ช่วงตั้ง 20-25A, ใช้กับระบบควบคุมมอเตอร์ TeSys series", qty:1 },
  { item:47, partNo:"LRD08", type:"Thermal Relay", system:"Relay", matDesc:"LRD08 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD08 thermal overload relay, ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 2.5-4A, ใช้กับ contactor รุ่น LC1-D09, ติดตั้งด้านล่าง contactor โดยตรง", qty:1 },
  { item:48, partNo:"LRD21-2", type:"Thermal Relay", system:"Relay", matDesc:"LRD21 - Schneider Electric - Thermal Overload Relay - Schneider Electric LRD21 thermal overload relay (unit 2), ใช้ป้องกันมอเตอร์จากกระแสเกิน (overload), ช่วงตั้ง 12-18A, ใช้กับ contactor รุ่น LC1-D25/D38", qty:1 },
  { item:49, partNo:"LV432695", type:"Molded Case Circuit Breaker", system:"Circuit Breaker", matDesc:"LV432695 - Schneider Electric - Molded Case Circuit Breaker (MCCB) - Schneider Electric LV432695 molded case circuit breaker, Compact NSX series, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งใน switchboard/switchgear, ใช้กับระบบจำหน่ายไฟฟ้า", qty:2 },
  { item:50, partNo:"TU2ba", type:"Current Transformer", system:"Current Transformer", matDesc:"TU2ba - Current Transformer (CT) - หม้อแปลงกระแส TU2ba, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty:1 },
  { item:51, partNo:"LC1F330", type:"Magnetic Contactor", system:"Contactor", matDesc:"LC1F330 - Schneider Electric - Magnetic Contactor - Schneider Electric LC1F330 magnetic contactor, 300A 3P, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์ขนาดใหญ่และโหลดอุตสาหกรรม, TeSys F series", qty:1 },
  { item:52, partNo:"BQ005959", type:"Watt Transducer", system:"Transducer", matDesc:"BQ005959 - Schneider Electric - Watt Transducer - Schneider Electric BQ005959 watt transducer, ใช้แปลงสัญญาณกำลังไฟฟ้า (W) เป็นสัญญาณมาตรฐาน (4-20mA/0-10V) สำหรับ SCADA/PLC, ใช้กับระบบ monitoring พลังงานไฟฟ้า", qty:1 },
  { item:53, partNo:"SD-N21", type:"Magnetic Contactor", system:"Contactor", matDesc:"SD-N21 - LS Electric - Magnetic Contactor - LS Electric SD-N21 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, Metasol series", qty:2 },
  { item:54, partNo:"SD-N11", type:"Magnetic Contactor", system:"Contactor", matDesc:"SD-N11 - LS Electric - Magnetic Contactor - LS Electric SD-N11 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, Metasol series", qty:1 },
  { item:55, partNo:"NF32-SW", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"NF32-SW - LS Electric - Miniature Circuit Breaker (MCB) - LS Electric NF32-SW miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty:5 },
  { item:56, partNo:"A013247", type:"Magnetic Contactor", system:"Contactor", matDesc:"A013247 - LS Electric - Magnetic Contactor - LS Electric A013247 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม", qty:1 },
  { item:57, partNo:"HMCP007C0C", type:"Motor Circuit Protector", system:"Circuit Breaker", matDesc:"HMCP007C0C - Hyundai - Motor Circuit Protector (MCP) - Hyundai HMCP007C0C motor circuit protector, ใช้ป้องกันมอเตอร์จาก short circuit, 7A rated, ใช้กับระบบควบคุมมอเตอร์, ติดตั้งในแผงควบคุม", qty:1 },
  { item:58, partNo:"NF125-SW", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"NF125-SW - LS Electric - Miniature Circuit Breaker (MCB) - LS Electric NF125-SW miniature circuit breaker, 125A, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า", qty:2 },
  { item:59, partNo:"S100-GF", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"S100-GF - ABB - Miniature Circuit Breaker (MCB) - ABB S100-GF miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit, พร้อม earth leakage protection (GFCI/RCBO), ติดตั้งบน DIN rail", qty:8 },
  { item:60, partNo:"CT20-100/5A", type:"Current Transformer", system:"Current Transformer", matDesc:"CT20 100/5A - Current Transformer (CT) - หม้อแปลงกระแส อัตราส่วน 100/5A, ใช้ลดกระแสไฟฟ้าจาก 100A เป็น 5A สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty:3 },
  { item:61, partNo:"CT30-300/5A", type:"Current Transformer", system:"Current Transformer", matDesc:"CT30 300/5A - Current Transformer (CT) - หม้อแปลงกระแส อัตราส่วน 300/5A, ใช้ลดกระแสไฟฟ้าจาก 300A เป็น 5A สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty:2 },
  { item:62, partNo:"IEC-EN-60947-2", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"IEC/EN 60947-2 - Miniature Circuit Breaker (MCB) - เบรกเกอร์ขนาดเล็ก มาตรฐาน IEC/EN 60947-2, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า", qty:2 },
  { item:63, partNo:"XDI-BCOVER", type:"Terminal Plug Cover", system:"Terminal Block", matDesc:"XDI-BCOVER - Terminal Plug Cover - ฝาครอบ/ปลั๊กปิดช่องว่างบน terminal block หรือ DIN rail, ใช้ป้องกันฝุ่นและการสัมผัสจุดต่อไฟฟ้า, ติดตั้งบนแผงควบคุม", qty:1 },
  { item:64, partNo:"SJ1725HA2", type:"Thermally Protected Device", system:"Motor Protection", matDesc:"SJ1725HA2 - Thermally Protected Device - อุปกรณ์ป้องกันความร้อน (thermal protector), ใช้ป้องกันมอเตอร์/อุปกรณ์ไฟฟ้าจากความร้อนเกิน, ตัดวงจรอัตโนมัติเมื่ออุณหภูมิเกินกำหนด", qty:5 },
  { item:65, partNo:"153640496", type:"DIN Rail Terminal Block", system:"Terminal Block", matDesc:"153640496 - Wago - DIN Rail Terminal Block - Wago 153640496 DIN rail terminal block, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, รองรับการต่อสายแบบ push-in/screw", qty:4 },
  { item:66, partNo:"103625710", type:"DIN Rail Terminal Block", system:"Terminal Block", matDesc:"103625710 - Wago - DIN Rail Terminal Block - Wago 103625710 DIN rail terminal block, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, รองรับการต่อสายแบบ push-in/screw", qty:1 },
];

// ===== NBK2: 37 items, Block 2 =====
const NBK2: { item: number; partNo: string; type: string; system: string; matDesc: string; qty: number }[] = [
  { item:1, partNo:"IRDH275B-435", type:"Insulation Monitor", system:"Insulation Monitor", matDesc:"IRDH275B-435 - Bender - Insulation Monitor - Bender IRDH275B-435 insulation monitoring device, ใช้ตรวจสอบฉนวนในระบบไฟฟ้า IT ไม่มีสายนอล (ungrounded), รองรับ AC/DC system, ใช้กับระบบจำหน่ายไฟฟ้าที่ต้องการติดตามค่าฉนวนแบบต่อเนื่อง", qty:1 },
  { item:2, partNo:"IRDH275-427", type:"Insulation Monitor", system:"Insulation Monitor", matDesc:"IRDH275-427 - Bender - Insulation Monitor - Bender IRDH275-427 insulation monitoring device, ใช้ตรวจสอบฉนวนในระบบไฟฟ้า IT ไม่มีสายนอล (ungrounded), รุ่น IRDH275 series, ใช้กับระบบจำหน่ายไฟฟ้าที่ต้องการติดตามค่าฉนวน", qty:1 },
  { item:3, partNo:"7PA22410", type:"Lockout Relay", system:"Relay", matDesc:"7PA22410 - ABB - Lockout Fast Relay - ABB 7PA22410 lockout fast relay, ใช้ล็อค/ป้องกันการเปิดวงจรซ้ำหลังเกิด fault (trip-lock), ใช้กับระบบป้องกันรีเลย์และ trip circuit ใน switchgear/switchboard", qty:1 },
  { item:4, partNo:"7PA22510", type:"Lockout Relay", system:"Relay", matDesc:"7PA22510 - ABB - Lockout Fast Relay - ABB 7PA22510 lockout fast relay, ใช้ล็อค/ป้องกันการเปิดวงจรซ้ำหลังเกิด fault (trip-lock), รุ่นต่างจาก 7PA22410, ใช้กับระบบป้องกันรีเลย์และ trip circuit ใน switchgear/switchboard", qty:1 },
  { item:5, partNo:"AC-22B", type:"Fuse Disconnector", system:"Fuse", matDesc:"AC-22B - ABB - Fuse Disconnector - ABB AC-22B fuse disconnector, ใช้ตัด/เชื่อมวงจรผ่านฟิวส์แบบ load-break, รองรับการดึงฟิวส์ภายใต้โหลด, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board) และ switchboard", qty:40 },
  { item:6, partNo:"7XP9010-1", type:"Flush Mounting Socket", system:"Relay Socket", matDesc:"7XP9010-1 - ABB - Flush Mounting Socket - ABB 7XP9010-1 flush mounting socket, ใช้ติดตั้งรีเลย์แบบฝัง (flush mount), รองรับรีเลย์อุตสาหกรรมแบบ plug-in, ใช้กับแผงควบคุม (control panel)", qty:4 },
  { item:7, partNo:"PRS21N01BH", type:"Auxiliary Relay", system:"Relay", matDesc:"PRS21N01BH - ABB - Auxiliary Relay - ABB PRS21N01BH auxiliary relay, ใช้ขยาย contact หรือสัญญาณควบคุมในวงจรไฟฟ้า, ใช้กับระบบควบคุมและ interlocking ใน switchgear/switchboard", qty:2 },
  { item:8, partNo:"A9A26919", type:"Auxiliary Contact / Fault Relay", system:"Relay", matDesc:"A9A26919 - ABB - Auxiliary Contact / Fault Signalling Relay - ABB A9A26919 auxiliary contact block / fault signalling relay, ใช้แสดงสถานะ fault/trip ของ circuit breaker, ติดตั้งภายในเบรกเกอร์หรือ accessories mounting, ใช้กับ ABB S200/Tmax series", qty:7 },
  { item:9, partNo:"611", type:"Industrial Plug-in Relay", system:"Relay", matDesc:"611 - ABB - Industrial Plug-in Relay D-R Series - ABB รีเลย์อุตสาหกรรมแบบ plug-in รุ่น D-R series, หมายเลข 611, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket", qty:3 },
  { item:10, partNo:"1029", type:"Industrial Plug-in Relay", system:"Relay", matDesc:"1029 - ABB - Industrial Plug-in Relay D Series - ABB รีเลย์อุตสาหกรรมแบบ plug-in รุ่น D series, หมายเลข 1029, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket", qty:3 },
  { item:11, partNo:"RS-NBK2-011", type:"Relay Socket", system:"Relay Socket", matDesc:"Relay Socket - ฐานรีเลย์ (Relay Socket) สำหรับติดตั้งรีเลย์อุตสาหกรรมแบบ plug-in, ใช้กับแผงควบคุม (control panel), รองรับ DIN Rail mounting", qty:6 },
  { item:12, partNo:"A038302", type:"Shunt Trip", system:"Circuit Breaker Accessory", matDesc:"A038302 - ABB - Shunt Trip Unit - ABB A038302 shunt trip unit, ใช้ตัดวงจรเบรกเกอร์แบบระยะไกลผ่านสัญญาณไฟฟ้า (remote tripping), ใช้กับ ABB circuit breaker รุ่น S200/Tmax series", qty:24 },
  { item:13, partNo:"RA4088/801", type:"Zero Sequence Current Transformer", system:"Current Transformer", matDesc:"RA4088/801 - ABB - Zero Sequence Current Transformer (ZSCT) - ABB RA4088/801 zero sequence current transformer, ใช้ตรวจจับกระแสรั่ว (leakage current) ในระบบ 3 เฟส, ใช้กับระบบป้องกัน earth leakage/ground fault", qty:4 },
  { item:14, partNo:"SG1501446-016", type:"Space Heater", system:"Heater", matDesc:"SG1501446-016 - ABB - Space Heater - ABB SG1501446-016 space heater, ใช้ทำความร้อนใน switchboard/enclosure เพื่อป้องกันความชื้นและ condensation, ใช้กับแผงจำหน่ายไฟฟ้าที่ติดตั้งในสภาพแวดล้อมชื้น", qty:2 },
  { item:15, partNo:"2CSF423005D1002", type:"Residual Current Relay", system:"Relay", matDesc:"2CSF423005D1002 - ABB - Residual Current Relay (RCM/RCD) - ABB 2CSF423005D1002 residual current relay, ใช้ตรวจจับและตัดวงจรกรณีกระแสรั่ว (earth leakage), ใช้กับระบบป้องกัน earth leakage protection", qty:20 },
  { item:16, partNo:"A038327", type:"Auxiliary Contact in Position", system:"Circuit Breaker Accessory", matDesc:"A038327 - ABB - Auxiliary Contact in Position - ABB A038327 auxiliary contact in position, ใช้แสดงสถานะตำแหน่ง (ON/OFF/tripped) ของ circuit breaker, ติดตั้งภายในเบรกเกอร์, ใช้กับ ABB S200/Tmax series", qty:4 },
  { item:17, partNo:"Lot.0159", type:"Residual Current Transformer", system:"Current Transformer", matDesc:"Lot.0159 - Residual Current Transformer (RC Core) - Residual current transformer (core balance) หมายเลข Lot.0159, ใช้ตรวจจับกระแสรั่วร่วมกับ residual current relay, ใช้กับระบบ earth leakage protection", qty:15 },
  { item:18, partNo:"RCT-NBK2-018", type:"Residual Current Transformer", system:"Current Transformer", matDesc:"Residual Current Transformer (RC Core) - หม้อแปลงกระแสรั่ว (core balance type), ใช้ตรวจจับกระแสรั่วร่วมกับ residual current relay, ใช้กับระบบ earth leakage protection", qty:1 },
  { item:19, partNo:"1025", type:"Industrial Relay", system:"Relay", matDesc:"1025 - ABB - Industrial Relay - ABB รีเลย์อุตสาหกรรม หมายเลข 1025, ใช้ควบคุมวงจรไฟฟ้าในแผงควบคุม (control panel), ติดตั้งบน relay socket แบบ plug-in", qty:4 },
  { item:20, partNo:"CS30323", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"CS30323 - ABB - Miniature Circuit Breaker (MCB) - ABB CS30323 miniature circuit breaker, ใช้ป้องกัน overcurrent และ short circuit ในวงจรไฟฟ้า, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty:7 },
  { item:21, partNo:"12D9", type:"Magnetic Contactor", system:"Contactor", matDesc:"12D9 - ABB - Magnetic Contactor - ABB 12D9 magnetic contactor, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล (remote switching), ใช้ควบคุมมอเตอร์, แสงสว่าง, หรือโหลดอื่น ๆ, ติดตั้งบน DIN rail", qty:2 },
  { item:22, partNo:"H3CR", type:"Analog Timer", system:"Timer", matDesc:"H3CR - Omron - Analog Timer - Omron H3CR analog timer relay, ใช้ตั้งเวลา delay ในวงจรควบคุม (on-delay / off-delay / interval), ใช้กับระบบอัตโนมัติและ control panel, มีช่วงเวลาตั้งแต่ 0.05 วินาที ถึง 12 ชั่วโมง", qty:13 },
  { item:23, partNo:"RF4XR", type:"Auxiliary Relay", system:"Relay", matDesc:"RF4XR - ABB - Auxiliary Relay - ABB RF4XR auxiliary relay, 4 changeover contacts, ใช้ขยาย contact หรือสัญญาณควบคุมในวงจรไฟฟ้า, ใช้กับระบบควบคุมและ interlocking ใน switchgear/switchboard", qty:3 },
  { item:24, partNo:"05199554C", type:"Current Transformer (CT)", system:"Current Transformer", matDesc:"05199554C - ABB - Current Transformer (CT) - ABB 05199554C current transformer, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty:1 },
  { item:25, partNo:"2CDS273001R0064", type:"Miniature Circuit Breaker", system:"Circuit Breaker", matDesc:"2CDS273001R0064 - ABB - Miniature Circuit Breaker (MCB) - ABB 2CDS273001R0064 miniature circuit breaker, System Pro M compact, ใช้ป้องกัน overcurrent และ short circuit, ติดตั้งบน DIN rail, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty:1 },
  { item:26, partNo:"GM-MCSC1000SM", type:"Fast Ethernet Converter", system:"Network Equipment", matDesc:"GM-MCSC1000SM - Korenix - Fast Ethernet Media Converter - Korenix (Beijer) GM-MCSC1000SM fast Ethernet media converter, แปลงสัญญาณระหว่าง copper (RJ45) กับ fiber optic, ใช้กับระบบเครือข่ายอุตสาหกรรม, รองรับ 100Mbps Fast Ethernet", qty:4 },
  { item:27, partNo:"AC-22B-2", type:"Fuse Disconnector", system:"Fuse", matDesc:"AC-22B - ABB - Fuse Disconnector - ABB AC-22B fuse disconnector (unit 2), ใช้ตัด/เชื่อมวงจรผ่านฟิวส์แบบ load-break, รองรับการดึงฟิวส์ภายใต้โหลด, ใช้กับแผงจำหน่ายไฟฟ้า (distribution board)", qty:20 },
  { item:28, partNo:"ACVT03", type:"Gigabit Fiber Media Converter", system:"Network Equipment", matDesc:"ACVT03 - ABB - Gigabit Fiber Media Converter - ABB ACVT03 gigabit fiber media converter, แปลงสัญญาณระหว่าง copper (RJ45) กับ fiber optic ความเร็ว 1Gbps, ใช้กับระบบเครือข่ายอุตสาหกรรมและ SCADA/automation", qty:8 },
  { item:29, partNo:"3300/078", type:"Digital Power Meter", system:"Power Meter", matDesc:"3300/078 - ABB - Digital Power Meter - ABB 3300/078 digital power meter, ใช้วัดค่าไฟฟ้า (V, A, W, VA, var, PF, Hz, kWh) ในระบบจำหน่ายไฟฟ้า, ติดตั้งบน switchboard/panel, ใช้กับระบบ monitoring และ energy management", qty:1 },
  { item:30, partNo:"YSBPL2-AL11", type:"Pilot Lamp", system:"Pilot Light", matDesc:"YSBPL2-AL11 - ABB - Pilot Lamp - ABB YSBPL2-AL11 pilot lamp, ใช้แสดงสถานะวงจรไฟฟ้า (ON/OFF/ALARM), ติดตั้งบน control panel แบบ flush mount, ใช้กับระบบแสดงสถานะและสัญญาณเตือน", qty:9 },
  { item:31, partNo:"YSBRL34-DL22", type:"Square Pilot Light", system:"Pilot Light", matDesc:"YSBRL34-DL22 - ABB - Square Pilot Light - ABB YSBRL34-DL22 square pilot light, ใช้แสดงสถานะวงจรไฟฟ้า (ON/OFF/ALARM) แบบทรงสี่เหลี่ยม, ติดตั้งบน control panel, ใช้กับระบบแสดงสถานะและสัญญาณเตือน", qty:3 },
  { item:32, partNo:"CT30", type:"Current Transformer (CT)", system:"Current Transformer", matDesc:"CT30 - ABB - Current Transformer (CT) - ABB CT30 current transformer, ใช้ลดกระแสไฟฟ้าจากค่าสูงเป็นค่าที่วัดได้สำหรับ metering/protection, รองรับกระแส rated 30A, ใช้กับระบบวัดกระแสและป้องกันใน switchboard", qty:2 },
  { item:33, partNo:"4121041062", type:"Terminal Block (4 pole)", system:"Terminal Block", matDesc:"4121041062 - ABB - Terminal Block 4 Pole - ABB 4121041062 terminal block 4 pole, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, 4 ขั้วต่อบล็อก", qty:1 },
  { item:34, partNo:"4121061203", type:"Terminal Block (2 pole)", system:"Terminal Block", matDesc:"4121061203 - ABB - Terminal Block 2 Pole - ABB 4121061203 terminal block 2 pole, ใช้เชื่อมต่อสายไฟฟ้าในแผงควบคุมและ switchboard, ติดตั้งบน DIN rail, 2 ขั้วต่อบล็อก", qty:1 },
  { item:35, partNo:"RF4", type:"Protective Relay", system:"Relay", matDesc:"RF4 - ABB - Protective Relay - ABB RF4 protective relay, 4 changeover contacts, ใช้ป้องกันและควบคุมวงจรไฟฟ้าในระบบ switchgear, ใช้กับระบบ interlocking และ protection scheme", qty:18 },
  { item:36, partNo:"RD2DI", type:"Interface Relay", system:"Relay", matDesc:"RD2DI - ABB - Interface Relay - ABB RD2DI interface relay, 2 changeover contacts, ใช้แปลงสัญญาณระหว่างระบบควบคุมกับวงจรกำลัง (interface/isolation), ติดตั้งบน DIN rail", qty:4 },
  { item:37, partNo:"3ZX10-12-0RH11-1AA1", type:"Contactor + Auxiliary Contact", system:"Contactor", matDesc:"3ZX10-12-0RH11-1AA1 - Siemens - Contactor + Auxiliary Contact - Siemens 3ZX10-12-0RH11-1AA1 contactor พร้อม auxiliary contact, ใช้สวิตช์โหลดไฟฟ้าแบบระยะไกล, ใช้ควบคุมมอเตอร์และโหลดอุตสาหกรรม, ติดตั้งบน DIN rail", qty:3 },
];

async function importItems(items: typeof NBK1, block: string, imgDir: string) {
  const building = await prisma.building.upsert({
    where: { name: "ท.021" },
    update: {},
    create: { name: "ท.021", sortOrder: 21, isActive: true },
  });

  // Ensure categories
  const systems = [...new Set(items.map(d => d.system))];
  const catMap: Record<string, string> = {};
  for (const sys of systems) {
    const cat = await prisma.category.upsert({ where: { name: sys }, update: {}, create: { name: sys } });
    catMap[sys] = cat.id;
  }

  let created = 0;
  let withImg = 0;

  for (const item of items) {
    const existing = await prisma.part.findUnique({ where: { partNumber: item.partNo } });
    if (existing) {
      console.log(`  SKIP: ${item.partNo}`);
      continue;
    }

    const part = await prisma.part.create({
      data: {
        partNumber: item.partNo,
        partName: item.type,
        description: item.matDesc,
        categoryId: catMap[item.system],
        buildingId: building.id,
        subcategory: item.system,
        plant: block,
        quantity: item.qty,
        minimumQuantity: 0,
        unit: "pcs",
        isActive: true,
      },
    });

    // Attach image: imgDir/item_XX.jpg
    const imgPath = path.join(imgDir, `item_${String(item.item).padStart(2, "0")}.jpg`);
    if (fs.existsSync(imgPath)) {
      const buf = fs.readFileSync(imgPath);
      const hash = crypto.createHash("md5").update(buf).digest("hex").slice(0, 8);
      const fname = `${part.id}-${hash}.jpg`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fname), buf);
      await prisma.part.update({ where: { id: part.id }, data: { imageUrl: `/uploads/parts/${fname}` } });
      withImg++;
    }

    created++;
    const icon = fs.existsSync(imgPath) ? "📷" : "❌";
    console.log(`  ${item.partNo} - ${item.type} (qty:${item.qty}) ${icon}`);
  }

  console.log(`\nBlock ${block}: ${created} created, ${withImg} with images`);
}

async function main() {
  console.log("=== Import NBK1 (Block 1) ===\n");
  await importItems(NBK1, "1", "/root/nbk1_images");

  console.log("\n=== Import NBK2 (Block 2) ===\n");
  await importItems(NBK2, "2", "/root/nbk2_images");

  // Final verify
  const building = await prisma.building.findFirst({ where: { name: "ท.021" } });
  const all = await prisma.part.findMany({ where: { buildingId: building.id }, select: { plant: true, imageUrl: true } });
  const b1 = all.filter(p => p.plant === "1").length;
  const b2 = all.filter(p => p.plant === "2").length;
  const img = all.filter(p => p.imageUrl).length;
  console.log(`\n=== FINAL ===`);
  console.log(`ท.021 total: ${all.length} (Block 1: ${b1}, Block 2: ${b2})`);
  console.log(`With image: ${img}, Without: ${all.length - img}`);
  const total = await prisma.part.count();
  console.log(`DB total parts: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
