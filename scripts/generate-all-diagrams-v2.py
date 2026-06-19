#!/usr/bin/env python3
"""Regenerate ER Diagram, System Architecture, and Flowcharts using Graphviz."""

import subprocess
import os
from datetime import datetime

DOT_BASE = r'C:\Program Files\Graphviz\bin\dot.exe'
OUT_DIR = r'C:\spare-part-stock\docs\images'
DPI = 200


def run_dot(dot_content: str, name: str):
    dot_path = os.path.join(OUT_DIR, f"{name}.dot")
    png_path = os.path.join(OUT_DIR, f"{name}.png")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(dot_path, "w", encoding="utf-8") as f:
        f.write(dot_content)
    cmd = [DOT_BASE, "-Tpng", f"-Gdpi={DPI}", "-o", png_path, dot_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ERROR rendering {name}: {result.stderr}")
        raise RuntimeError(f"Graphviz failed for {name}")
    print(f"[{datetime.now():%H:%M:%S}] Rendered {png_path} ({os.path.getsize(png_path):,} bytes)")


ER_DIAGRAM = r'''
digraph ERDiagram {
    rankdir=LR;
    bgcolor="white";
    fontname="Segoe UI";
    label="รูปที่ X  Entity-Relationship Diagram (ER Diagram)\nระบบจัดการสต็อกอะไหล่";
    labelloc="t";
    fontsize=20;
    fontcolor="#1e293b";
    pad="0.6";
    nodesep=0.8;
    ranksep=1.8;
    splines=ortho;
    overlap=false;
    concentrate=false;

    node [shape=plain fontname="Segoe UI" fontsize=11 margin="0.15,0.08"];
    edge [fontname="Segoe UI" fontsize=10 color="#64748b" arrowsize=0.75 penwidth=1.3 minlen=2];

    // ---------- TABLES ----------
    User [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#eff6ff">
        <TR><TD COLSPAN="2" BGCOLOR="#2563eb"><FONT COLOR="white" POINT-SIZE="13"><B>👤 ผู้ใช้งาน (User)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="160">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">username <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">password</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">name</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">role (ADMIN/STAFF)</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">isActive</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">mustChangePassword</TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">lineUserId <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
    </TABLE>>];

    LineAccount [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#f5f3ff">
        <TR><TD COLSPAN="2" BGCOLOR="#7c3aed"><FONT COLOR="white" POINT-SIZE="13"><B>💬 บัญชี LINE (LineAccount)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="170">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">lineUserId <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">userId <FONT COLOR="#166534">[FK→User]</FONT></TD></TR>
    </TABLE>>];

    Category [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#fffbeb">
        <TR><TD COLSPAN="2" BGCOLOR="#d97706"><FONT COLOR="white" POINT-SIZE="13"><B>📁 หมวดหมู่ (Category)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="150">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">name <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
    </TABLE>>];

    Building [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#ecfdf5">
        <TR><TD COLSPAN="2" BGCOLOR="#059669"><FONT COLOR="white" POINT-SIZE="13"><B>🏭 อาคาร (Building)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="150">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">name <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">sortOrder</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">isActive</TD></TR>
    </TABLE>>];

    Part [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#fef2f2">
        <TR><TD COLSPAN="2" BGCOLOR="#dc2626"><FONT COLOR="white" POINT-SIZE="13"><B>🔧 อะไหล่ (Part)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="170">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">partNumber <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">partName</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">description</TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">categoryId <FONT COLOR="#166534">[FK→Category]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">buildingId <FONT COLOR="#166534">[FK→Building]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">quantity, minimumQuantity</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">unit, location, plant</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">imageUrl, qrCodeUrl</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">imageEmbedding, textEmbedding</TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">barcodeValue <FONT COLOR="#6b21a8">[UQ]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">isActive</TD></TR>
    </TABLE>>];

    StockMovement [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#fff7ed">
        <TR><TD COLSPAN="2" BGCOLOR="#ea580c"><FONT COLOR="white" POINT-SIZE="13"><B>📦 การเคลื่อนไหวสต็อก (StockMovement)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="190">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">partId <FONT COLOR="#166534">[FK→Part]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">userId <FONT COLOR="#166534">[FK→User]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">type (IN/OUT/ADJ)</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">quantityBefore</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">quantityAfter</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">quantityChange</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">note</TD></TR>
    </TABLE>>];

    Conversation [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#ecfeff">
        <TR><TD COLSPAN="2" BGCOLOR="#06b6d4"><FONT COLOR="white" POINT-SIZE="13"><B>💬 บทสนทนา (Conversation)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="180">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">lineUserId / lineGroupId</TD></TR>
    </TABLE>>];

    ConversationMessage [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#cffafe">
        <TR><TD COLSPAN="2" BGCOLOR="#0891b2"><FONT COLOR="white" POINT-SIZE="13"><B>📝 ข้อความ (ConversationMessage)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="190">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">conversationId <FONT COLOR="#166534">[FK→Conversation]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">role / content</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">messageType</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">metadata</TD></TR>
    </TABLE>>];

    AiPendingAction [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#faf5ff">
        <TR><TD COLSPAN="2" BGCOLOR="#9333ea"><FONT COLOR="white" POINT-SIZE="13"><B>🤖 การดำเนินการ AI (AiPendingAction)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="190">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">userId <FONT COLOR="#166534">[FK→User]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">channel, actionType</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">payloadJson, summary</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">status, expiresAt</TD></TR>
    </TABLE>>];

    GroupImageContext [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#f1f5f9">
        <TR><TD COLSPAN="2" BGCOLOR="#475569"><FONT COLOR="white" POINT-SIZE="13"><B>🖼️ บริบทรูปกลุ่ม (GroupImageContext)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="190">id <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">groupId, imageMessageId</TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">senderUserId</TD></TR>
    </TABLE>>];

    AppSetting [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#f5f5f4">
        <TR><TD COLSPAN="2" BGCOLOR="#78716c"><FONT COLOR="white" POINT-SIZE="13"><B>⚙️ ตั้งค่าระบบ (AppSetting)</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="20">🔑</TD><TD ALIGN="LEFT" WIDTH="150">key <FONT COLOR="#92400e">[PK]</FONT></TD></TR>
        <TR><TD ALIGN="LEFT"> </TD><TD ALIGN="LEFT">value, category</TD></TR>
    </TABLE>>];

    Legend [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" BGCOLOR="#f8fafc">
        <TR><TD COLSPAN="2" BGCOLOR="#334155"><FONT COLOR="white" POINT-SIZE="12"><B>คำอธิบายสัญลักษณ์</B></FONT></TD></TR>
        <TR><TD ALIGN="LEFT" WIDTH="30">🔑</TD><TD ALIGN="LEFT" WIDTH="140">Primary Key (คีย์หลัก)</TD></TR>
        <TR><TD ALIGN="LEFT">🔗</TD><TD ALIGN="LEFT">Foreign Key (คีย์อ้างอิง)</TD></TR>
        <TR><TD ALIGN="LEFT">◎</TD><TD ALIGN="LEFT">Unique (ห้ามซ้ำ)</TD></TR>
        <TR><TD ALIGN="LEFT">—</TD><TD ALIGN="LEFT">1 ต่อหลาย (1:N)</TD></TR>
    </TABLE>>];

    // ---------- RELATIONSHIPS ----------
    User -> LineAccount [label="มี" taillabel="1" headlabel="N" color="#2563eb" fontcolor="#1e40af" headport=w tailport=e style=bold];
    User -> StockMovement [label="บันทึก" taillabel="1" headlabel="N" color="#2563eb" fontcolor="#1e40af" headport=w tailport=e style=bold];
    User -> AiPendingAction [label="รอดำเนินการ" taillabel="1" headlabel="N" color="#2563eb" fontcolor="#1e40af" headport=w tailport=e style=bold];

    Category -> Part [label="ประกอบด้วย" taillabel="1" headlabel="N" color="#d97706" fontcolor="#92400e" headport=w tailport=s style=bold];
    Building -> Part [label="อยู่ใน" taillabel="1" headlabel="N" color="#059669" fontcolor="#166534" headport=n tailport=s style=bold];
    Part -> StockMovement [label="มีประวัติ" taillabel="1" headlabel="N" color="#dc2626" fontcolor="#991b1b" headport=n tailport=e style=bold];
    Conversation -> ConversationMessage [label="ประกอบด้วย" taillabel="1" headlabel="N" color="#0891b2" fontcolor="#155e75" headport=w tailport=e style=bold];

    // ---------- LAYOUT RANKING ----------
    {rank=same; User; Category; Building}
    {rank=same; LineAccount; Part; Conversation}
    {rank=same; StockMovement; AiPendingAction; ConversationMessage; GroupImageContext; AppSetting}
}
'''


ARCHITECTURE_DIAGRAM = r'''
digraph SystemArchitecture {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="รูปที่ X  System Architecture Diagram\nโครงสร้างระบบจัดการสต็อกอะไหล่";
    labelloc="t";
    fontsize=20;
    fontcolor="#1e293b";
    pad="0.7";
    nodesep=0.55;
    ranksep=1.2;
    splines=true;
    overlap=false;

    node [shape=box fontname="Segoe UI" fontsize=11 style="rounded,filled" margin="0.2,0.1"];
    edge [fontname="Segoe UI" fontsize=9 color="#64748b" arrowsize=0.7 penwidth=1.2];

    // ---------- CLIENT LAYER ----------
    subgraph cluster_client {
        label="Client Layer (ชั้นผู้ใช้)";
        labeljust="c";
        fontsize=16;
        fontcolor="#1e40af";
        style="rounded,dashed";
        color="#3b82f6";
        bgcolor="#eff6ff";
        penwidth=2;

        WebApp [label="🌐 Web App\nNext.js (เบราว์เซอร์)\nSession Auth" fillcolor="#dbeafe" color="#2563eb"];
        LIFFApp [label="📱 LIFF App\nLINE In-App Browser\nLINE Token Auth" fillcolor="#ede9fe" color="#7c3aed"];
        MobileApp [label="🤖 Mobile App\nFlutter (Android)\nBearer + API Key" fillcolor="#dcfce7" color="#16a34a"];
        LINEBot [label="💬 LINE Bot\nMessaging API Webhook\n(1-on-1 / Group)" fillcolor="#fce7f3" color="#db2777"];
    }

    // ---------- SERVER LAYER ----------
    subgraph cluster_server {
        label="Server Layer (ชั้นเซิร์ฟเวอร์) — Next.js";
        labeljust="c";
        fontsize=16;
        fontcolor="#166534";
        style="rounded,dashed";
        color="#22c55e";
        bgcolor="#f0fdf4";
        penwidth=2;

        APIRoutes [label="🔗 API Routes\nWeb / LIFF / Mobile / LINE" fillcolor="#bbf7d0" color="#16a34a" penwidth=2];
        ServerActions [label="⚡ Server Actions\nForm Mutations" fillcolor="#bbf7d0" color="#16a34a"];
        AuthModule [label="🔒 Auth Module\nbetter-auth + RBAC" fillcolor="#bbf7d0" color="#16a34a"];

        AIOrchestrator [label="🧠 AI Orchestrator\nIntent → Action Pipeline" fillcolor="#d1fae5" color="#059669"];
        PrismaORM [label="🗄️ Prisma ORM\n+ Validation\nbetter-sqlite3 adapter" fillcolor="#d1fae5" color="#059669"];
        EmbeddingSvc [label="🔍 Embedding Service\nCLIP (local) + Voyage AI" fillcolor="#d1fae5" color="#059669"];
    }

    // ---------- DATA LAYER ----------
    subgraph cluster_data {
        label="Data Layer (ชั้นข้อมูล)";
        labeljust="c";
        fontsize=16;
        fontcolor="#9a3412";
        style="rounded,dashed";
        color="#f97316";
        bgcolor="#fff7ed";
        penwidth=2;

        SQLite [label="🗄️ SQLite Database\n10 Tables + Vector Index\nbetter-sqlite3" fillcolor="#fed7aa" color="#ea580c" penwidth=2];
        Uploads [label="📂 Uploads / Images\nFilesystem" fillcolor="#fed7aa" color="#ea580c"];
    }

    // ---------- EXTERNAL SERVICES ----------
    subgraph cluster_external {
        label="External Services (บริการภายนอก)";
        labeljust="c";
        fontsize=16;
        fontcolor="#7c2d12";
        style="rounded,dashed";
        color="#ef4444";
        bgcolor="#fef2f2";
        penwidth=2;

        LLMGateway [label="🧠 LLM Gateway\nOpenAI-compatible API\nLiteLLM / Reverse Proxy" fillcolor="#fecaca" color="#dc2626" penwidth=2];
        LINEPlatform [label="💚 LINE Platform\nMessaging API + Login + LIFF" fillcolor="#fecaca" color="#dc2626"];
        VoyageAI [label="📊 Voyage AI\nText Embeddings\nvoyage-4-lite" fillcolor="#fecaca" color="#dc2626"];
        Tavily [label="🔎 Tavily\nWeb Search API" fillcolor="#fecaca" color="#dc2626"];
    }

    // ---------- EDGES ----------
    // Client → Server
    WebApp -> APIRoutes [label="HTTPS" color="#3b82f6" fontcolor="#1e40af"];
    LIFFApp -> APIRoutes [label="HTTPS" color="#7c3aed" fontcolor="#5b21b6"];
    MobileApp -> APIRoutes [label="HTTPS" color="#16a34a" fontcolor="#166534"];
    LINEBot -> APIRoutes [label="Webhook" color="#db2777" fontcolor="#9d174d" dir=both];

    // Server internal
    APIRoutes -> ServerActions [style=dashed color="#16a34a"];
    APIRoutes -> AuthModule [style=dashed color="#16a34a"];
    APIRoutes -> AIOrchestrator [color="#16a34a"];
    AIOrchestrator -> EmbeddingSvc [color="#16a34a"];
    AIOrchestrator -> PrismaORM [color="#16a34a"];
    EmbeddingSvc -> PrismaORM [color="#16a34a" style=dashed];

    // Server → Data
    PrismaORM -> SQLite [label="Queries" color="#ea580c" fontcolor="#9a3412" penwidth=1.8];
    APIRoutes -> Uploads [label="Upload" color="#ea580c" fontcolor="#9a3412"];

    // Server → External
    AIOrchestrator -> LLMGateway [label="Chat Completions" color="#dc2626" fontcolor="#991b1b" penwidth=1.8];
    APIRoutes -> LINEPlatform [label="Push / Reply" color="#dc2626" fontcolor="#991b1b"];
    LIFFApp -> LINEPlatform [label="Login / LIFF" color="#dc2626" fontcolor="#991b1b" style=dashed];
    EmbeddingSvc -> VoyageAI [label="Embed API" color="#dc2626" fontcolor="#991b1b"];
    AIOrchestrator -> Tavily [label="Search" color="#dc2626" fontcolor="#991b1b" style=dashed];
}
'''


ADD_PART_FLOWCHART = r'''
digraph AddPartFlow {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="รูปที่ X  Flowchart — การเพิ่มอะไหล่ (Add Part)";
    labelloc="t";
    fontsize=20;
    fontcolor="#1e293b";
    pad="0.5";
    nodesep=0.45;
    ranksep=0.75;
    splines=ortho;

    node [shape=box fontname="Segoe UI" fontsize=11 style="rounded,filled" margin="0.18,0.1"];
    edge [fontname="Segoe UI" fontsize=10 color="#64748b" arrowsize=0.7 penwidth=1.1];

    Start [label="เริ่มต้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];
    ChooseMethod [label="เลือกช่องทาง\nWeb / LIFF / Mobile" fillcolor="#eff6ff" color="#3b82f6"];
    UploadImage [label="ถ่าย/อัปโหลดรูปภาพ\nอะไหล่" fillcolor="#fef3c7" color="#d97706"];
    AISuggest [label="AI วิเคราะห์รูป\nแนะนำชื่อ/หมวดหมู่/รายละเอียด" fillcolor="#f5f3ff" color="#7c3aed"];
    Review [label="ผู้ใช้ตรวจสอบ\nและแก้ไขข้อมูล" fillcolor="#fffbeb" color="#d97706"];
    Save [label="บันทึกอะไหล่\n+ สร้าง QR/Barcode" fillcolor="#dcfce7" color="#16a34a"];
    Success [label="เสร็จสิ้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];

    Cancel [label="ยกเลิก" fillcolor="#fee2e2" color="#dc2626" shape=ellipse];

    Start -> ChooseMethod;
    ChooseMethod -> UploadImage [label="เพิ่มอะไหล่"];
    UploadImage -> AISuggest [label="AI Suggest"];
    AISuggest -> Review;
    Review -> Save [label="ข้อมูลถูกต้อง"];
    Save -> Success;
    Review -> Cancel [label="ยกเลิก" color="#dc2626"];
}
'''


SEARCH_FLOWCHART = r'''
digraph SearchFlow {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="รูปที่ X  Flowchart — การค้นหาอะไหล่";
    labelloc="t";
    fontsize=20;
    fontcolor="#1e293b";
    pad="0.5";
    nodesep=0.45;
    ranksep=0.75;
    splines=ortho;

    node [shape=box fontname="Segoe UI" fontsize=11 style="rounded,filled" margin="0.18,0.1"];
    edge [fontname="Segoe UI" fontsize=10 color="#64748b" arrowsize=0.7 penwidth=1.1];

    Start [label="เริ่มต้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];
    Input [label="เลือกวิธีค้นหา\nข้อความ / รูป / QR" fillcolor="#eff6ff" color="#3b82f6"];
    TextOrImage [label="ข้อความหรือรูป?" fillcolor="#fffbeb" color="#d97706" shape=diamond];
    TextSearch [label="ค้นหาด้วยคำ\nSQL LIKE" fillcolor="#f5f3ff" color="#7c3aed"];
    ImageSearch [label="ค้นหาด้วย Vector\nImage Embedding" fillcolor="#f5f3ff" color="#7c3aed"];
    Hybrid [label="Hybrid Search\nรวม Text + Vector" fillcolor="#f5f3ff" color="#7c3aed"];
    ShowResults [label="แสดงผลลัพธ์\nพร้อมค่าความคล้าย" fillcolor="#dcfce7" color="#16a34a"];
    Details [label="ดูรายละเอียด\nและประวัติสต็อก" fillcolor="#dcfce7" color="#16a34a"];
    End [label="เสร็จสิ้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];

    Start -> Input;
    Input -> TextOrImage;
    TextOrImage -> TextSearch [label="ข้อความ"];
    TextOrImage -> ImageSearch [label="รูป"];
    TextSearch -> Hybrid;
    ImageSearch -> Hybrid;
    Hybrid -> ShowResults;
    ShowResults -> Details [label="เลือกรายการ"];
    Details -> End;
}
'''


STOCK_MOVEMENT_FLOWCHART = r'''
digraph StockFlow {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="รูปที่ X  Flowchart — การรับ-เบิก-ปรับยอดสต็อก";
    labelloc="t";
    fontsize=20;
    fontcolor="#1e293b";
    pad="0.5";
    nodesep=0.45;
    ranksep=0.75;
    splines=ortho;

    node [shape=box fontname="Segoe UI" fontsize=11 style="rounded,filled" margin="0.18,0.1"];
    edge [fontname="Segoe UI" fontsize=10 color="#64748b" arrowsize=0.7 penwidth=1.1];

    Start [label="เริ่มต้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];
    ScanOrSelect [label="สแกน QR/Barcode\nหรือเลือกอะไหล่" fillcolor="#eff6ff" color="#3b82f6"];
    ChooseType [label="เลือกประเภท\nIN / OUT / ADJUST" fillcolor="#fffbeb" color="#d97706" shape=diamond];
    StockIn [label="รับเข้าคลัง\n(STOCK_IN)" fillcolor="#dcfce7" color="#16a34a"];
    StockOut [label="เบิกออก\n(STOCK_OUT)" fillcolor="#fee2e2" color="#dc2626"];
    Adjustment [label="ปรับยอด\n(ADJUSTMENT)" fillcolor="#fef9c3" color="#ca8a04"];
    Validate [label="ตรวจสอบ\nจำนวนคงเหลือ ≥ 0" fillcolor="#fffbeb" color="#d97706" shape=diamond];
    UpdateDB [label="อัปเดตฐานข้อมูล\nบันทึก StockMovement" fillcolor="#dcfce7" color="#16a34a"];
    End [label="เสร็จสิ้น" fillcolor="#dbeafe" color="#2563eb" shape=ellipse];
    Reject [label="ปฏิเสธ\nแจ้งเตือนผู้ใช้" fillcolor="#fee2e2" color="#dc2626" shape=ellipse];

    Start -> ScanOrSelect;
    ScanOrSelect -> ChooseType;
    ChooseType -> StockIn [label="IN"];
    ChooseType -> StockOut [label="OUT"];
    ChooseType -> Adjustment [label="ADJUST"];
    StockIn -> Validate;
    StockOut -> Validate;
    Adjustment -> Validate;
    Validate -> UpdateDB [label="ผ่าน"];
    Validate -> Reject [label="ติดลบ" color="#dc2626"];
    UpdateDB -> End;
}
'''


if __name__ == "__main__":
    diagrams = [
        (ER_DIAGRAM, "er-diagram-v2"),
        (ARCHITECTURE_DIAGRAM, "architecture-diagram-v2"),
        (ADD_PART_FLOWCHART, "flowchart-add-part"),
        (SEARCH_FLOWCHART, "flowchart-search"),
        (STOCK_MOVEMENT_FLOWCHART, "flowchart-stock-movement"),
    ]
    for dot, name in diagrams:
        run_dot(dot, name)
    print("\n✅ All diagrams regenerated successfully.")
