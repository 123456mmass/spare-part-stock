# Production Deployment Notes

## Environment Variables

เปลี่ยนชื่อ env var ต่อไปนี้ก่อน deploy:

| ก่อน | หลัง | เหตุผล |
|-------|------|--------|
| `NEXT_PUBLIC_API_KEY` | `API_KEY` | `NEXT_PUBLIC_` prefix ทำให้ค่า API Key หลุดไป JavaScript bundle ฝั่ง client |

ค่า key เดิมใช้ต่อได้ — เปลี่ยนแค่ชื่อตัวแปร:

```env
# ก่อน
NEXT_PUBLIC_API_KEY="d3dbe09f74dd9bc0cd7f3bc444d0eb4b18aeda0ea2c1c70ffe7152f114656f97"

# หลัง
API_KEY="d3dbe09f74dd9bc0cd7f3bc444d0eb4b18aeda0ea2c1c70ffe7152f114656f97"
```

## Mobile App Build (Flutter)

Hardcoded API key ถูกลบออกจาก source code แล้ว — ต้อง inject key ผ่าน `--dart-define` ตอน build:

```bash
# Android APK (release)
flutter build apk --release \
  --dart-define=API_KEY=20557da01a920d06d2d64f880d888746abdea9a0c428f6487f114efb2e9b88ac \
  --dart-define=API_BASE_URL=https://spare.birdsphichitchai.dev

# iOS (release)
flutter build ios --release \
  --dart-define=API_KEY=... \
  --dart-define=API_BASE_URL=...
```

**สำคัญ**: เปลี่ยน `MOBILE_API_KEY` ใน `.env` และใช้ค่าใหม่ตอน build — key เดิมที่เคย hardcode ใน source code ควรถือว่า compromised แล้ว

```env
# สร้าง key ใหม่
MOBILE_API_KEY="<สร้างใหม่ด้วย: node scripts/generate-mobile-key.ts>"
```

## Architecture Changes

- **Web authentication**: ใช้ session cookie (httpOnly, secure, sameSite strict) เป็นหลัก — ไม่ต้องส่ง `X-API-Key` header จาก browser
- **Mobile authentication**: ใช้ `MOBILE_API_KEY` + JWT Bearer token — ไม่เปลี่ยนแปลง
- **`verifyApiKey()`**: ยังมีอยู่เป็น utility สำหรับกรณีที่ต้องการ API-key-only access (เช่น scripts, external tools) — fail closed ต้องตั้งค่า `API_KEY` และส่ง header ให้ตรง
- **Temp password**: เพิ่มความยาวจาก 6 → 10 ตัวอักษร เพิ่ม entropy

## ถ้าไม่เปลี่ยน env var

- **Web login**: ยังทำงานได้ (ไม่ใช้ API key แล้ว)
- **Web routes (session-based)**: ยังทำงานได้ (ใช้ session cookie)
- **ฟังก์ชัน `verifyApiKey()`**: จะ throw `Unauthorized` ทันที — แต่ไม่มี route ไหนเรียกใช้แล้ว
- **Mobile API**: ไม่กระทบ (ใช้ `MOBILE_API_KEY` แยก)

## Security Checklist

- [ ] เปลี่ยน `NEXT_PUBLIC_API_KEY` → `API_KEY` ใน `.env` / environment variables
- [ ] สร้าง `MOBILE_API_KEY` ใหม่ (key เก่าหลุดใน source code)
- [ ] Build Flutter app ด้วย `--dart-define=API_KEY=<key ใหม่>`
- [ ] ตรวจสอบว่า `JWT_SECRET` ถูกตั้งค่าและเป็น secret ที่ปลอดภัย
- [ ] ตั้งค่า `SPARE_PART_AI_GATEWAY_KEY` หรือ `LLM_GATEWAY_API_KEY` สำหรับ AI features
- [ ] รัน `npm run build` หลังเปลี่ยน env vars
- [ ] ทดสอบ login ทั้ง web และ mobile
- [ ] เปลี่ยนรหัสผ่าน default user ทั้งหมด
