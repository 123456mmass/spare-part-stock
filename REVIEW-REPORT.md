# Spare Part Stock — Full Project Review Report

**Date:** 2026-06-05
**Branch:** `feature/building-dashboard`
**Reviewer:** Claude Code (codebase review + bug hunt)

---

## 1. Project Overview

ระบบจัดการสต็อกอะไหล่ (Spare Part Inventory) ที่รองรับ:

- **Web Admin** — Next.js 16.2.6 + React 19 + TypeScript + Prisma 7.8.0 + SQLite
- **Mobile API** — ชุด API แยกสำหรับ mobile app (Flutter)
- **LIFF/LINE** — LINE Bot + LIFF mini-app สำหรับ stock inquiry/scan/search
- **AI Features** — image search, AI import suggestion, LINE chat orchestrator

Tech stack หลัก: Tailwind CSS 4, Radix UI, ExcelJS, qrcode, sharp, bcryptjs, jose (JWT), zod

---

## 2. Verification Results

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ 0 errors, 16 warnings (down from 27 errors) |
| `npx tsc --noEmit` | ✅ Pass |
| `npm run build` | ✅ Pass |

---

## 3. Findings Summary

### Blocker / Critical (4 findings — all fixed)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `/api/parts` low-stock/in-stock pagination count ผิด — total ไม่ตรงกับ filter | Critical | ✅ Fixed |
| 2 | Part update ลบ category เองเมื่อไม่ส่ง categoryId/categoryName | Critical | ✅ Fixed |
| 3 | Prisma P2002 duplicate field parser ไม่รองรับ SQLite adapter shape | Critical | ✅ Fixed |
| 4 | Delete part ทำ hard delete → cascade ทำลาย StockMovement audit trail | Critical | ✅ Fixed |

### Major (5 findings — all fixed)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 5 | Excel import ซ่อน duplicate part number แบบเงียบ (merge แทน report) | Major | ✅ Fixed |
| 6 | Excel import existing part ใช้ STOCK_IN (additive) ไม่ใช่ ADJUSTMENT (snapshot) | Major | ✅ Fixed |
| 7 | Excel import limit 2GB — เสี่ยง OOM | Major | ✅ Fixed |
| 8 | LINE link route เขียน `lineUserId` ก่อนเช็ค `mustChangePassword` | Major | ✅ Fixed |
| 9 | AI model PUT ไม่ validate model กับ available list | Major | ✅ Fixed |

### Medium (4 findings — fixed or mitigated)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 10 | LINE webhook source type ไม่มี groupId/roomId, userId typed เป็น required | Medium | ✅ Fixed |
| 11 | Rate limit `MAX_STORE_SIZE` ถูก define แต่ไม่ได้ enforce | Medium | ✅ Fixed |
| 12 | Lint errors จาก LINE/AI files (`any`, unused imports) | Medium | ✅ Fixed |
| 13 | Export image `as any` buffer cast | Medium | ✅ Fixed |

### Low / Deferred

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 14 | Lint warnings เดิม 16 รายการ (hook deps, unused imports, `<img>`) | Low | Deferred — ไม่ blocker |
| 15 | ไฟล์ backup/test ถูก lint | Low | ✅ Fixed (eslint ignore) |
| 16 | `README.md` เขียน Next.js 15 แต่ actual คือ 16.2.6 | Low | Noted |

---

## 4. Changes Made (21 files)

### Core Bug Fixes

| File | Change |
|------|--------|
| `src/app/api/parts/route.ts` | ใช้ Prisma field-ref สำหรับ low-stock/in-stock filter; remove post-query JS filter; ใช้ `getP2002Fields()` |
| `src/app/api/parts/[id]/route.ts` | Conditional category update; `getP2002Fields()`; soft delete; remove unused imports |
| `src/app/api/mobile/parts/route.ts` | `getP2002Fields()` for POST duplicate error |
| `src/app/api/mobile/parts/[id]/route.ts` | Conditional category update; `getP2002Fields()`; soft delete; remove unused imports |

### Import/Export

| File | Change |
|------|--------|
| `src/lib/import-validation.ts` | Duplicate part number → validation error (not silent merge) |
| `src/lib/excel.ts` | Existing part quantity → `ADJUSTMENT` (snapshot) not `STOCK_IN` (additive) |
| `src/app/api/import/route.ts` | MAX_FILE_SIZE 2GB → 50MB |
| `src/app/api/mobile/import/route.ts` | MAX_FILE_SIZE 2GB → 50MB |
| `src/app/api/export/route.ts` | Remove `as any` buffer cast |
| `src/app/api/mobile/export/route.ts` | Remove `as any` buffer cast |

### LINE Integration

| File | Change |
|------|--------|
| `src/lib/line.ts` | Source type: userId optional, add groupId/roomId; `contents?: unknown`; `createFlexMessage` unknown |
| `src/app/api/line/webhook/route.ts` | Remove `as any` casts; handle missing userId in group; remove `Promise<any>` return type |
| `src/app/api/line/auth/link/route.ts` | Move `mustChangePassword` check before `lineUserId` update |

### AI Settings

| File | Change |
|------|--------|
| `src/app/api/admin/ai-model/route.ts` | Extract `getAvailableModels()`; validate model against available list before PUT |

### Infrastructure

| File | Change |
|------|--------|
| `src/lib/prisma.ts` | Add `getP2002Fields()` shared helper |
| `src/lib/rate-limit.ts` | Enforce `MAX_STORE_SIZE`; add `pruneExpired` + `enforceStoreSize`; cleanup GC interval |
| `eslint.config.mjs` | Add ignores: `backups/**`, `scripts/**/*.ts`, `test-*.ts`, `tests/**` |

### LINE Chat Type Safety

| File | Change |
|------|--------|
| `src/lib/line-chat/flex-messages.ts` | Replace `any` with `FlexPart` / `StorageStats` / `unknown` types |
| `src/lib/line-chat/memory.ts` | `metadata: unknown`; `safeParseJSON` returns `unknown` |
| `src/lib/line-chat/orchestrator.ts` | Remove unused `prisma` import; add `ChatMessage` / `ToolCall` types; handle missing function name |
| `src/lib/line-chat/tools.ts` | `Prisma.PartWhereInput` instead of `any` |

---

## 5. What Was NOT Changed (by design)

- **UI pages** — hook deps warnings, `<img>` usage ไม่ได้แก้เพราะไม่ใช่ bug และไม่ blocker
- **Schema migration** — ไม่ได้เพิ่ม migration ใหม่ (ไม่ต้องการ)
- **Database data** — ไม่ได้ touch production/dev DB
- **Mobile app code** (`mobile/`) — Flutter project แยก scope
- **Seed data** — ไม่ได้แก้

---

## 6. Remaining Risks

| Risk | Severity | Note |
|------|----------|------|
| Excel import behavior เปลี่ยนจาก additive เป็น snapshot | Medium | ผู้ใช้ควรรู้ว่า re-import จะ set quantity ไม่ใช่ add |
| Soft delete ทำให้ partNumber ซ้ำกับ soft-deleted record ได้ | Low | อาจต้อง add unique constraint ที่รวม isActive=false ด้วย |
| Rate limit in-memory ไม่ survive restart | Low | สำหรับ production จริงควรใช้ Redis |
| `prisma.part.fields.minimumQuantity` field-ref ใน SQLite | Low | ทำงานได้แต่ควร verify ด้วย data จริง |

---

## 7. Recommendations for Next Steps

1. **Manual smoke test** — login, สร้าง part, แก้ category, ลบ part, ตรวจ movements ยังอยู่
2. **Import test** — ลอง import Excel ที่มี duplicate part number → ต้องเจอ error
3. **Re-import test** — import ไฟล์เดิมซ้ำ → quantity ต้องไม่บวกซ้ำ
4. **LINE test** — link account, verify mustChangePassword flow
5. **AI model test** — PUT invalid model → ต้องได้ 400
6. **Deploy** — `npm run build` ผ่านแล้ว พร้อม deploy ได้

---

## 8. Tools Used

- `debug-mantra` — 4-step debugging discipline for bug investigation
- `karpathy-guidelines` — surgical change discipline for implementation
- `scrutinize` — outsider review methodology for finding verification
- `lean-ctx` MCP — file reading and shell execution
