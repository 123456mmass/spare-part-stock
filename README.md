# Spare Part Stock Management System

ระบบจัดการสต็อกอะไหล่  ใช้ deploy และบำรุงรักษา.

## ภาพรวมระบบ

- **ตัวเว็บแอป (Next.js)** — deploy บน server 
- **AI Gateway** — ทำงานอยู่บนเครื่องอื่น (`https://gateway.birdsphichitchai.dev`) ตัวเว็บแอปจะเรียกผ่าน HTTPS
- **ฐานข้อมูล** — SQLite (`dev.db`) เก็บในเครื่องเดียวกับเว็บแอป
- **ข้อมูลผู้ใช้/รูปอะไหล่** — เก็บใน `dev.db` และ `public/uploads/` บนเครื่องเว็บแอป (ไม่ได้อยู่ใน git)

```
[Browser] ─HTTPS─> [nginx+Next.js on ] ─HTTPS─> [AI Gateway: gateway.birdsphichitchai.dev]
                                   │                          (อยู่เครื่องอื่น, ไม่ต้องดูแลฝั่งนี้)
                                   └─> [dev.db + uploads on EGAT]
```

## Tech Stack

- Next.js 16.2.6, React 19, TypeScript
- Prisma 7.8 + SQLite
- PM2 (process manager), nginx (reverse proxy)
- ต้องการ **Node.js v24+**

## ข้อกำหนดเบื้องต้น (ฝ่าย IT เตรียมก่อน deploy)

1. เซิร์ฟเวอร์ Linux ที่ติดตั้ง:
   - **Node.js v24+** (ตรวจสอบ: `node -v`)
   - **npm**
   - **PM2** — ติดตั้งด้วย `npm i -g pm2`
   - **nginx**
   - **git**
2. **อนุญาต outbound HTTPS** ไปยัง:
   - `gateway.birdsphichitchai.dev` (AI gateway — สำคัญมาก ถ้าบล็อก AI จะใช้งานไม่ได้)
   - `api.line.me` (LINE Login/LIFF — ถ้าใช้)
3. โดเมน + SSL (ใช้ Let's Encrypt / certbot ได้)
4. ไฟล์ข้อมูลที่จัดเตรียมให้ (อยู่ใน **zip package** ไม่อยู่ใน git — ส่งให้แยก):
   - ภายใน zip มี: `.env` (ค่า config + **secret/API key ทั้งหมด**), `dev.db` (ฐานข้อมูล), `public/uploads/` (รูปอะไหล่)
   - แตก zip แล้ว copy ไฟล์ทั้ง 3 อย่างนี้เข้าโฟลเดอร์แอป

> ไฟล์ `.env` / `dev.db` / `public/uploads/` **ไม่อยู่ใน git** (ถูก gitignore ไว้เพื่อความปลอดภัย) ต้องเอาจาก zip เท่านั้น
> ⚠️ **zip มี secret จริงทั้งหมด** — เก็บในที่ปลอดภัย หลัง deploy สำเร็จให้ **rotate key** แล้วลบ zip ทิ้ง

---

## การติดตั้งครั้งแรก (One-time Deployment)

```bash
# 1. clone โค้ด
git clone https://github.com/123456mmass/spare-part-stock.git
cd spare-part-stock

# 2. copy ไฟล์ข้อมูลเข้าโฟลเดอร์ (จากที่จัดเตรียมให้)
cp /path/to/.env .
cp /path/to/dev.db .
cp -r /path/to/uploads public/uploads/

# 3. ติดตั้ง dependencies + สร้าง Prisma client + build
npm ci
npx prisma generate
npx prisma migrate deploy        # ควรขึ้น "Database schema is up to date"

# 4. build production
npm run build

# 5. เริ่มรันด้วย PM2
pm2 start ecosystem.config.cjs
pm2 save                          # บันทึกให้รู้จักตั้งแต่ boot เครื่อง

# 6. ตั้งค่า nginx + SSL (ตัวอย่าง)
#    proxy_pass http://127.0.0.1:3000;
#    certbot --nginx -d your-domain
```

หลังขั้นที่ 5 เสร็จ เว็บจะรันอยู่ที่ `http://127.0.0.1:3000` (รอ nginx proxy ออกสู่ภายนอก).

---

## การอัปเดต (ทุกครั้งที่มีโค้ดใหม่)

**คำสั่งเดียวจบ:**

```bash
cd /path/to/spare-part-stock
npm run update
```

`npm run update` จะทำให้อัตโนมัติ:
1. `git pull` (ดึงโค้ดใหม่)
2. `npm ci` (ติดตั้ง dependencies ใหม่)
3. `prisma generate` + `prisma migrate deploy` (อัปเดต schema ถ้ามี)
4. `npm run build` (build ใหม่)
5. `pm2 restart` (รีสตาร์ทเซิร์ฟเวอร์)

> **ข้อมูล `.env` / `dev.db` / `uploads` จะไม่ถูกแตะ** (ปลอดภัย ข้อมูลคงเดิม)

อีกวิธีที่ทำงานเหมือนกัน: `./deploy.sh`

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ความหมาย |
|---|---|
| `npm run update` | อัปเดตโค้ด + build + restart (ใช้บ่อยสุด) |
| `npm run build` | build production อย่างเดียว |
| `npm run dev` | รัน dev server (ห้ามใช้บน production) |
| `npm run lint` | ตรวจสอบคุณภาพโค้ด |
| `pm2 logs spare-part-stock` | ดู log แบบ real-time |
| `pm2 restart spare-part-stock` | รีสตาร์ทเซิร์ฟเวอร์ |
| `pm2 status` | ดูสถานะ process |
| `npx prisma studio` | เปิด Prisma Studio (ดู/แก้ข้อมูล DB) |

---

## หมายเหตุสำคัญ

### เปลี่ยนโดเมน
ถ้า deploy บนโดเมนใหม่ (ไม่ใช่ `spare.birdsphichitchai.dev`):
1. แก้ `NEXT_PUBLIC_APP_URL` ใน `.env` เป็นโดเมนใหม่
2. รัน `npm run build` ใหม่ (ค่านี้ฝังใน client bundle)
3. `pm2 restart spare-part-stock`

### AI Gateway
- `.env` ชี้ `LLM_GATEWAY_BASE_URL` และ `SPARE_PART_AI_GATEWAY_URL` ไปที่ `https://gateway.birdsphichitchai.dev`
- ตัว gateway อยู่บนเครื่องอื่น — ฝ่าย IT ฝั่งเว็บแอป **ไม่ต้องดูแล** แค่ให้เครื่องเว็บแอปเรียก HTTPS ไปถึง
- ถ้า AI ไม่ตอบ → ตรวจ `pm2 logs` และเช็คว่าเครื่องออกเน็ตไป `gateway.birdsphichitchai.dev` ได้

### ความปลอดภัย
- `.env` มี secret ทั้งหมด (JWT, LINE, gateway key) — **อย่า commit ขึ้น git / อย่าแชร์**
- หลัง deploy ครั้งแรก ควร **เปลี่ยนรหัสผ่าน admin** และพิจารณา rotate secret ทั้งหมด
- `dev.db` มีข้อมูลผู้ใช้ + สต็อกทั้งหมด — backup สม่ำเสมอ (`cp dev.db dev.db.backup-$(date +%F)`)

### Backup
```bash
cp dev.db dev.db.backup-$(date +%F)
```

---

## โครงสร้างโปรเจกต์ (สั้น)

```
src/
├── app/            # Next.js App Router (pages + API routes)
│   ├── (protected)/ # หน้าที่ต้อง login (dashboard, parts, movements, ...)
│   ├── api/         # API routes
│   └── liff/        # LINE LIFF pages
├── components/      # UI components
└── lib/             # utilities (prisma, auth, stock, excel, ...)
prisma/              # schema + migrations
public/uploads/      # รูปอะไหล่ (ข้อมูล, ไม่อยู่ใน git)
ecosystem.config.cjs # PM2 config
deploy.sh            # deploy script (= npm run update)
```

## License

MIT
