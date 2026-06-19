"""Rebuild Appendix A (Project Structure) in report-v10b-final.docx as a clean
monospace tree: path in Consolas (dark), inline comment in gray italic.

Strategy:
  - Delete the old appendix-A body paragraphs (paras after the two heading lines
    up to 'ภาคผนวก ข').
  - Insert a single bordered/shaded code-block paragraph holding the whole tree,
    OR one monospace paragraph per line (cleaner Word rendering, safer).
  - Each line split into two runs: [path + tree glyphs] (Consolas sz18, dark)
    and [ # comment ] (Consolas sz18, gray italic) when a comment exists.
"""
import sys
from copy import deepcopy
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

sys.stdout.reconfigure(encoding='utf-8')

SRC = 'docs/report-v10b-final.docx'
DST = 'docs/report-v10b-final.docx'  # in-place

doc = Document(SRC)

# ---- locate appendix A span ----
start_idx = None   # heading 'ภาคผนวก ก'
end_idx = None     # heading 'ภาคผนวก ข'
paras = doc.paragraphs
for i, p in enumerate(paras):
    t = p.text.strip()
    if t == 'ภาคผนวก ก' and start_idx is None:
        start_idx = i
    elif start_idx is not None and t == 'ภาคผนวก ข':
        end_idx = i
        break

print(f"Appendix A heading at para {start_idx}, ends before para {end_idx}")
assert start_idx is not None and end_idx is not None

heading_elem = paras[start_idx]._element
parent = heading_elem.getparent()

# The second paragraph (title 'โครงสร้างโปรเจกต์') should be kept.
# Collect body paragraphs to delete: from start_idx+2 up to end_idx-1.
to_delete = []
for i in range(start_idx + 2, end_idx):
    to_delete.append(paras[i]._element)

# remember insertion reference = title paragraph element (start_idx+1)
title_elem = paras[start_idx + 1]._element

# ---- the new tree content ----
# Each line is the raw tree string. We split on the first '  #' for comment styling.
TREE = [
    "spare-part-stock/",
    "├── docs/                       # เอกสารรายงานและภาพประกอบ",
    "├── prisma/",
    "│   ├── migrations/             # Migration ฐานข้อมูล SQLite",
    "│   └── schema.prisma           # Prisma Schema",
    "├── public/                     # ไฟล์ static (QR code, รูปภาพ)",
    "├── scripts/                    # สคริปต์สร้างรายงาน/นำเข้าข้อมูล",
    "├── src/",
    "│   ├── app/",
    "│   │   ├── (protected)/        # หน้าที่ต้องล็อกอิน",
    "│   │   │   ├── dashboard/      # สรุป Dashboard",
    "│   │   │   ├── parts/          # จัดการอะไหล่",
    "│   │   │   ├── movements/      # ประวัติ Stock Movement",
    "│   │   │   ├── scan/           # สแกน QR/Barcode",
    "│   │   │   ├── import/         # นำเข้า Excel",
    "│   │   │   ├── categories/     # จัดการหมวดหมู่",
    "│   │   │   ├── buildings/      # จัดการอาคาร",
    "│   │   │   ├── blocks/         # จัดการบล็อก",
    "│   │   │   ├── users/          # จัดการผู้ใช้",
    "│   │   │   ├── assistant/      # AI Assistant",
    "│   │   │   └── settings/       # ตั้งค่า (AI, รหัสผ่าน)",
    "│   │   ├── api/                # Next.js API Routes",
    "│   │   │   ├── account/        # ข้อมูลบัญชีผู้ใช้",
    "│   │   │   ├── admin/          # APIs สำหรับผู้ดูแลระบบ",
    "│   │   │   ├── ai/             # AI: chat, actions",
    "│   │   │   ├── auth/           # Authentication",
    "│   │   │   ├── blocks/         # จัดการบล็อก",
    "│   │   │   ├── buildings/      # จัดการอาคาร",
    "│   │   │   ├── categories/     # จัดการหมวดหมู่",
    "│   │   │   ├── cron/           # Cron jobs",
    "│   │   │   ├── dashboard/      # Dashboard API",
    "│   │   │   ├── export/         # ส่งออกข้อมูล",
    "│   │   │   ├── import/         # นำเข้าข้อมูล",
    "│   │   │   ├── liff/           # LINE LIFF APIs",
    "│   │   │   ├── line/           # LINE Webhook",
    "│   │   │   ├── mobile/         # REST APIs สำหรับ App มือถือ",
    "│   │   │   ├── movements/      # Stock Movement API",
    "│   │   │   └── parts/          # Parts API",
    "│   │   ├── liff/               # LINE LIFF mini app",
    "│   │   │   ├── add-part/       # เพิ่มอะไหล่ผ่าน LIFF",
    "│   │   │   ├── search/         # ค้นหาอะไหล่",
    "│   │   │   └── stock-move/     # รับ/จ่ายสต็อก",
    "│   │   ├── login/              # หน้าเข้าสู่ระบบ",
    "│   │   └── layout.tsx          # Root layout",
    "│   ├── components/",
    "│   │   ├── layout/             # Sidebar, Header, BottomNav",
    "│   │   └── ui/                 # shadcn/ui (Button, Table, Dialog)",
    "│   ├── lib/                    # core logic",
    "│   │   ├── ai-assistant/       # AI Assistant engine",
    "│   │   ├── line-chat/          # LINE Bot orchestration",
    "│   │   ├── ai-client.ts        # LLM client config",
    "│   │   ├── auth.ts             # Auth helpers",
    "│   │   ├── embeddings.ts       # Vector / text embeddings",
    "│   │   ├── excel.ts            # Excel read/write",
    "│   │   ├── part-lookup.ts      # Part search service",
    "│   │   ├── prisma.ts           # Prisma Client singleton",
    "│   │   ├── session.ts          # JWT/session",
    "│   │   ├── stock.ts            # Stock movement logic",
    "│   │   └── utils.ts            # Utility functions",
    "│   └── proxy.ts                # Proxy utilities",
    "├── .env.example                # ตัวอย่าง environment variables",
    "├── next.config.ts              # ค่า config Next.js",
    "├── package.json                # Dependencies + scripts",
    "├── postcss.config.mjs          # PostCSS config",
    "├── README.md                   # คู่มือการใช้งาน",
    "└── tsconfig.json               # TypeScript config",
]

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
MONO = 'Consolas'

def make_rPr(*, bold=False, italic=False, color=None, size_half=18):
    rPr = OxmlElement('w:rPr')
    rFonts = OxmlElement('w:rFonts')
    rFonts.set(qn('w:ascii'), MONO)
    rFonts.set(qn('w:hAnsi'), MONO)
    rFonts.set(qn('w:cs'), MONO)
    # keep Thai font for any Thai glyphs in comments
    rFonts.set(qn('w:eastAsia'), 'TH SarabunPSK')
    rPr.append(rFonts)
    if bold:
        rPr.append(OxmlElement('w:b'))
    if italic:
        i = OxmlElement('w:i'); rPr.append(i)
        rPr.append(OxmlElement('w:iCs'))
    sz = OxmlElement('w:sz'); sz.set(qn('w:val'), str(size_half)); rPr.append(sz)
    szCs = OxmlElement('w:szCs'); szCs.set(qn('w:val'), str(size_half)); rPr.append(szCs)
    if color:
        c = OxmlElement('w:color'); c.set(qn('w:val'), color); rPr.append(c)
    return rPr

def make_run(text, **props):
    r = OxmlElement('w:r')
    r.append(make_rPr(**props))
    t = OxmlElement('w:t')
    t.set(qn('xml:space'), 'preserve')
    t.text = text
    r.append(t)
    return r

def make_line_para(path_text, comment_text):
    p = OxmlElement('w:p')
    pPr = OxmlElement('w:pPr')
    # keep with next, no widow control, small spacing
    spacing = OxmlElement('w:spacing')
    spacing.set(qn('w:after'), '0')
    spacing.set(qn('w:line'), '240')
    spacing.set(qn('w:lineRule'), 'auto')
    pPr.append(spacing)
    # left indent so the block sits a bit inside
    ind = OxmlElement('w:ind'); ind.set(qn('w:left'), '240'); pPr.append(ind)
    p.append(pPr)
    p.append(make_run(path_text, size_half=18, color='1F2937'))
    if comment_text:
        p.append(make_run(comment_text, size_half=18, italic=True, color='6B7280'))
    return p

# ---- delete old body paragraphs ----
for el in to_delete:
    el.getparent().remove(el)
print(f"Deleted {len(to_delete)} old appendix-A body paragraphs")

# ---- insert new tree lines after title_elem ----
ref = title_elem
for line in TREE:
    # split path vs '  # comment'
    if '  #' in line:
        path_part, comment_part = line.split('  #', 1)
        comment_part = '  #' + comment_part
    else:
        path_part, comment_part = line, ''
    new_p = make_line_para(path_part, comment_part)
    ref.addnext(new_p)
    ref = new_p

print(f"Inserted {len(TREE)} tree lines")

doc.save(DST)
print(f"Saved: {DST}")
