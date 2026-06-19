#!/usr/bin/env python3
"""Generate System Architecture Diagram using Graphviz DOT for Spare Part Stock system."""

import subprocess
import os

DOT_CONTENT = r'''
digraph SystemArchitecture {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="System Architecture — ระบบจัดการสต็อกอะไหล่";
    labelloc="t";
    fontsize=22;
    fontcolor="#1e293b";
    pad="0.5";
    nodesep=0.4;
    ranksep=0.8;
    compound=true;

    node [shape=box fontname="Segoe UI" fontsize=11 style="rounded,filled" fillcolor="white" color="#94a3b8" penwidth=1.5];
    edge [fontname="Segoe UI" fontsize=9 color="#94a3b8" arrowsize=0.7 penwidth=1.2];

    // ========== CLIENT LAYER ==========
    subgraph cluster_client {
        label="Client Layer";
        labeljust="c";
        fontsize=16;
        fontcolor="#1e40af";
        style="rounded,dashed";
        color="#3b82f6";
        bgcolor="#eff6ff";
        penwidth=2;

        WebApp [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Web App</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Next.js (Browser)</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">Session Auth</FONT></TD></TR>
        </TABLE>> fillcolor="#dbeafe" color="#3b82f6"];

        LIFFApp [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>LIFF App</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Next.js (LINE In-App)</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">LINE Token Auth</FONT></TD></TR>
        </TABLE>> fillcolor="#ede9fe" color="#8b5cf6"];

        MobileApp [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Mobile App</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Flutter (Android)</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">Bearer + API Key</FONT></TD></TR>
        </TABLE>> fillcolor="#dcfce7" color="#22c55e"];

        LINEBot [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>LINE Bot</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Messaging API</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">Webhook</FONT></TD></TR>
        </TABLE>> fillcolor="#fce7f3" color="#ec4899"];

        {rank=same; WebApp; LIFFApp; MobileApp; LINEBot}
    }

    // ========== SERVER LAYER ==========
    subgraph cluster_server {
        label="Server Layer (Next.js App)";
        labeljust="c";
        fontsize=16;
        fontcolor="#166534";
        style="rounded,dashed";
        color="#22c55e";
        bgcolor="#f0fdf4";
        penwidth=2;

        APIRoutes [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>API Routes</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Web / LIFF / Mobile / LINE</FONT></TD></TR>
        </TABLE>> fillcolor="#bbf7d0" color="#22c55e" penwidth=2];

        ServerActions [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Server Actions</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Form Mutations</FONT></TD></TR>
        </TABLE>> fillcolor="#bbf7d0" color="#22c55e"];

        PrismaORM [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Prisma ORM</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">better-sqlite3 + Validation</FONT></TD></TR>
        </TABLE>> fillcolor="#d1fae5" color="#10b981"];

        EmbeddingSvc [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Embedding Service</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">CLIP (local) + Voyage AI</FONT></TD></TR>
        </TABLE>> fillcolor="#d1fae5" color="#10b981"];

        AIOrchestrator [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>AI Orchestrator</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Intent → Action Pipeline</FONT></TD></TR>
        </TABLE>> fillcolor="#d1fae5" color="#10b981"];

        AuthModule [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Auth Module</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">better-auth + RBAC</FONT></TD></TR>
        </TABLE>> fillcolor="#d1fae5" color="#10b981"];

        {rank=same; APIRoutes; ServerActions; AuthModule}
        {rank=same; PrismaORM; EmbeddingSvc; AIOrchestrator}
    }

    // ========== DATA LAYER ==========
    subgraph cluster_data {
        label="Data Layer";
        labeljust="c";
        fontsize=16;
        fontcolor="#9a3412";
        style="rounded,dashed";
        color="#f97316";
        bgcolor="#fff7ed";
        penwidth=2;

        SQLite [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>SQLite Database</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">better-sqlite3</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">10 Tables + Vector Index</FONT></TD></TR>
        </TABLE>> fillcolor="#fed7aa" color="#f97316" penwidth=2];

        Uploads [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Uploads / Images</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">File System</FONT></TD></TR>
        </TABLE>> fillcolor="#fed7aa" color="#f97316"];

        {rank=same; SQLite; Uploads}
    }

    // ========== EXTERNAL SERVICES ==========
    subgraph cluster_external {
        label="External Services";
        labeljust="c";
        fontsize=16;
        fontcolor="#7c2d12";
        style="rounded,dashed";
        color="#ea580c";
        bgcolor="#fef2f2";
        penwidth=2;

        LLMGateway [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>LLM Gateway</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">OpenAI-compatible API</FONT></TD></TR>
            <TR><TD><FONT POINT-SIZE="8" COLOR="#6b7280">LiteLLM / Reverse Proxy</FONT></TD></TR>
        </TABLE>> fillcolor="#fecaca" color="#ef4444" penwidth=2];

        LINEPlatform [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>LINE Platform</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Messaging API + Login + LIFF</FONT></TD></TR>
        </TABLE>> fillcolor="#fecaca" color="#ef4444"];

        VoyageAI [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Voyage AI</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Text Embeddings (voyage-4-lite)</FONT></TD></TR>
        </TABLE>> fillcolor="#fecaca" color="#ef4444"];

        Tavily [label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="2">
            <TR><TD><B>Tavily</B></TD></TR>
            <TR><TD><FONT POINT-SIZE="9">Web Search API</FONT></TD></TR>
        </TABLE>> fillcolor="#fecaca" color="#ef4444"];

        {rank=same; LLMGateway; LINEPlatform; VoyageAI; Tavily}
    }

    // ========== EDGES: Client → Server ==========
    WebApp -> APIRoutes [label="HTTPS" color="#3b82f6" fontcolor="#3b82f6"];
    LIFFApp -> APIRoutes [label="HTTPS" color="#8b5cf6" fontcolor="#8b5cf6"];
    MobileApp -> APIRoutes [label="HTTPS" color="#22c55e" fontcolor="#22c55e"];
    LINEBot -> APIRoutes [label="Webhook" color="#ec4899" fontcolor="#ec4899" dir=both];

    // ========== EDGES: Server Internal ==========
    APIRoutes -> ServerActions [style=dashed color="#22c55e"];
    APIRoutes -> AuthModule [style=dashed color="#22c55e"];
    APIRoutes -> AIOrchestrator [color="#22c55e"];
    AIOrchestrator -> EmbeddingSvc [color="#22c55e"];
    AIOrchestrator -> PrismaORM [color="#22c55e"];
    EmbeddingSvc -> PrismaORM [style=dashed color="#10b981"];

    // ========== EDGES: Server → Data ==========
    PrismaORM -> SQLite [label="Queries" color="#f97316" fontcolor="#f97316" penwidth=2];
    APIRoutes -> Uploads [label="Upload" color="#f97316" fontcolor="#f97316"];

    // ========== EDGES: Server → External ==========
    AIOrchestrator -> LLMGateway [label="Chat Completions" color="#ef4444" fontcolor="#ef4444" penwidth=2];
    APIRoutes -> LINEPlatform [label="Push/Reply" color="#ef4444" fontcolor="#ef4444"];
    LIFFApp -> LINEPlatform [label="Login/LIFF" color="#ef4444" fontcolor="#ef4444" dir=both style=dashed];
    EmbeddingSvc -> VoyageAI [label="Embed API" color="#ef4444" fontcolor="#ef4444"];
    AIOrchestrator -> Tavily [label="Search" color="#ef4444" fontcolor="#ef4444" style=dashed];
}
'''

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    output_dir = os.path.join(project_dir, "docs", "images")
    os.makedirs(output_dir, exist_ok=True)

    dot_path = os.path.join(output_dir, "architecture-diagram.dot")
    png_path = os.path.join(output_dir, "architecture-diagram.png")

    with open(dot_path, "w", encoding="utf-8") as f:
        f.write(DOT_CONTENT)
    print(f"DOT file written: {dot_path}")

    dot_exe = r"C:\Program Files\Graphviz\bin\dot.exe"
    if not os.path.exists(dot_exe):
        raise FileNotFoundError(f"Graphviz dot.exe not found at {dot_exe}")

    cmd = [dot_exe, "-Tpng", "-Gdpi=200", "-o", png_path, dot_path]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr}")
        raise RuntimeError(f"Graphviz failed with code {result.returncode}")

    print(f"Architecture Diagram saved: {png_path}")
    file_size = os.path.getsize(png_path)
    print(f"File size: {file_size:,} bytes")

if __name__ == "__main__":
    main()
