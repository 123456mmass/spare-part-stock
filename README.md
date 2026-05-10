# Spare Part Stock Management System

ระบบจัดการสต็อกอะไหล่ อุตสาหกรรม ที่ทันสมัยและใช้งานง่าย

## Features

- รองรับ Desktop และ Mobile
- ระบบ QR Code สำหรับสแกนและติดตามอะไหล่
- นำเข้าข้อมูลจาก Excel พร้อมรูปภาพ
- ระบบ Track การเคลื่อนไหวของสต็อก
- รองรับ Role-based Authentication (ADMIN/STAFF)
- Responsive Design สวยงาม
- PWA ติดตั้งบนมือถือได้

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: TailwindCSS, shadcn/ui, Lucide React
- **Database**: Prisma ORM, SQLite (Dev), PostgreSQL (Production)
- **Auth**: Better Auth
- **Excel**: exceljs, xlsx
- **Image**: sharp
- **QR**: qrcode, @yudiel/react-qr-scanner

## Installation

### 1. Clone และติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment

```bash
cp .env.example .env
```

### 3. รัน Database Migration

```bash
npx prisma migrate dev
```

### 4. สร้าง Seed Data

```bash
npx prisma db seed
```

### 5. รัน Development Server

```bash
npm run dev
```

เปิด http://localhost:3000

## Default Login

- **Username**: admin
- **Password**: admin123

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | รัน Development Server |
| `npm run build` | Build Production |
| `npm run start` | รัน Production Server |
| `npm run lint` | ตรวจสอบ Lint |
| `npx prisma studio` | เปิด Prisma Studio |
| `npx prisma db seed` | สร้าง Seed Data |

## Project Structure

```
src/
├── app/
│   ├── (protected)/     # Protected Routes
│   │   ├── dashboard/   # Dashboard
│   │   ├── parts/       # Parts Management
│   │   ├── movements/   # Stock Movements
│   │   ├── scan/        # QR Scanner
│   │   ├── import/      # Excel Import
│   │   └── categories/  # Categories
│   ├── api/             # API Routes
│   └── login/           # Login Page
├── components/
│   ├── ui/              # shadcn/ui Components
│   ├── layout/          # Layout Components
│   └── ...
└── lib/
    ├── prisma.ts        # Prisma Client
    ├── auth.ts          # Auth Utilities
    ├── utils.ts         # Utility Functions
    ├── excel.ts         # Excel Processing
    └── qrcode.ts        # QR Code Generation
```

## Excel Import Format

| Column | Required | Description |
|--------|----------|-------------|
| Part Number | Yes | รหัสอะไหล่ (unique) |
| Part Name | Yes | ชื่ออะไหล่ |
| Description | No | รายละเอียด |
| Category | No | หมวดหมู่ (สร้างอัตโนมัติถ้ายังไม่มี) |
| Location | No | ที่เก็บ |
| Quantity | Yes | จำนวน |
| Minimum Quantity | No | ขั้นต่ำ (default: 0) |
| Unit | No | หน่วย (default: pcs) |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Connect to Vercel
3. Add Environment Variables:
   - `DATABASE_URL` (PostgreSQL connection string for production)
4. Deploy!

### Manual Deployment

```bash
npm run build
npm start
```

## License

MIT
