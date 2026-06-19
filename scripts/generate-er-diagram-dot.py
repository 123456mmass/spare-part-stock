#!/usr/bin/env python3
"""Generate ER Diagram using Graphviz DOT language for Spare Part Stock system."""

import subprocess
import os

DOT_CONTENT = r'''
digraph ERDiagram {
    rankdir=TB;
    bgcolor="white";
    fontname="Segoe UI";
    label="ER Diagram — ระบบจัดการสต็อกอะไหล่";
    labelloc="t";
    fontsize=22;
    fontcolor="#1e293b";
    pad="0.5";
    nodesep=0.6;
    ranksep=1.2;
    splines=ortho;

    // ========== NODE STYLES ==========
    node [shape=plain fontname="Segoe UI" fontsize=11];
    edge [fontname="Segoe UI" fontsize=10 color="#64748b" arrowsize=0.8];

    // ========== User ==========
    User [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#3b82f6"><FONT COLOR="white"><B>User</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">username</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">password</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">role</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">ADMIN|STAFF</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">isActive</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">mustChangePassword</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">lineUserId?</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== LineAccount ==========
    LineAccount [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#8b5cf6"><FONT COLOR="white"><B>LineAccount</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">lineUserId</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">userId</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→User</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">displayName</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">pictureUrl?</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== Category ==========
    Category [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#f59e0b"><FONT COLOR="white"><B>Category</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== Building ==========
    Building [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#10b981"><FONT COLOR="white"><B>Building</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">name</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">sortOrder</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">isActive</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== Part ==========
    Part [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#ef4444"><FONT COLOR="white"><B>Part</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">partNumber</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">partName</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">description?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">categoryId?</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→Category</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">buildingId?</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→Building</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">subcategory?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">plant?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">location?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">quantity</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">minimumQuantity</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">unit</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">imageUrl?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">imageEmbedding?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">textEmbedding?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">qrCodeUrl?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">barcodeValue?</TD><TD ALIGN="LEFT"><FONT COLOR="#6b21a8">UQ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">isActive</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== StockMovement ==========
    StockMovement [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#f97316"><FONT COLOR="white"><B>StockMovement</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">partId</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→Part</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">userId</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→User</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">type</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">IN|OUT|ADJ</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">quantityBefore</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">quantityAfter</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">quantityChange</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">note?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== Conversation ==========
    Conversation [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#06b6d4"><FONT COLOR="white"><B>Conversation</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">lineUserId?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">lineGroupId?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== ConversationMessage ==========
    ConversationMessage [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#0891b2"><FONT COLOR="white"><B>ConversationMessage</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">conversationId</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→Conversation</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">role</TD><TD ALIGN="LEFT">user|assistant|system</TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">content</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">messageType</TD><TD ALIGN="LEFT">text|image|command</TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">metadata?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== AiPendingAction ==========
    AiPendingAction [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#a855f7"><FONT COLOR="white"><B>AiPendingAction</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">userId</TD><TD ALIGN="LEFT"><FONT COLOR="#166534">FK→User</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">channel</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">conversationId?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">actionType</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">payloadJson</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">summary</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">status</TD><TD ALIGN="LEFT">PENDING</TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">expiresAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== GroupImageContext ==========
    GroupImageContext [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#64748b"><FONT COLOR="white"><B>GroupImageContext</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">id</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">groupId</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">imageMessageId</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">senderUserId</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== AppSetting ==========
    AppSetting [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="3" BGCOLOR="#78716c"><FONT COLOR="white"><B>AppSetting</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">key</TD><TD ALIGN="LEFT"><FONT COLOR="#92400e">PK</FONT></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">value</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">category?</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">createdAt</TD><TD ALIGN="LEFT"></TD></TR>
        <TR><TD></TD><TD ALIGN="LEFT">updatedAt</TD><TD ALIGN="LEFT"></TD></TR>
    </TABLE>>];

    // ========== LEGEND ==========
    Legend [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">
        <TR><TD COLSPAN="2" BGCOLOR="#334155"><FONT COLOR="white"><B>สัญลักษณ์ (Legend)</B></FONT></TD></TR>
        <TR><TD>🟡</TD><TD ALIGN="LEFT">Primary Key (PK)</TD></TR>
        <TR><TD>🟢</TD><TD ALIGN="LEFT">Foreign Key (FK)</TD></TR>
        <TR><TD>🟣</TD><TD ALIGN="LEFT">Unique Constraint (UQ)</TD></TR>
        <TR><TD>?</TD><TD ALIGN="LEFT">Nullable Field</TD></TR>
        <TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="9">Cascade Delete: User→LineAccount, User→AiPendingAction, Part→StockMovement, Conversation→ConversationMessage</FONT></TD></TR>
    </TABLE>>];

    // ========== RELATIONSHIPS ==========
    // User 1:N LineAccount (cascade)
    User -> LineAccount [label="1:N" fontcolor="#3b82f6" color="#3b82f6" style=bold headlabel=" " taillabel=" "];

    // User 1:N StockMovement
    User -> StockMovement [label="1:N" fontcolor="#3b82f6" color="#3b82f6" style=bold];

    // User 1:N AiPendingAction (cascade)
    User -> AiPendingAction [label="1:N" fontcolor="#3b82f6" color="#3b82f6" style=bold];

    // Category 1:N Part
    Category -> Part [label="1:N" fontcolor="#f59e0b" color="#f59e0b" style=bold];

    // Building 1:N Part
    Building -> Part [label="1:N" fontcolor="#10b981" color="#10b981" style=bold];

    // Part 1:N StockMovement (cascade)
    Part -> StockMovement [label="1:N" fontcolor="#ef4444" color="#ef4444" style=bold];

    // Conversation 1:N ConversationMessage (cascade)
    Conversation -> ConversationMessage [label="1:N" fontcolor="#06b6d4" color="#06b6d4" style=bold];

    // ========== RANK CONSTRAINTS ==========
    {rank=same; User; Category; Building}
    {rank=same; LineAccount; Part; Conversation}
    {rank=same; StockMovement; AiPendingAction; ConversationMessage; GroupImageContext; AppSetting}
}
'''

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    output_dir = os.path.join(project_dir, "docs", "images")
    os.makedirs(output_dir, exist_ok=True)

    dot_path = os.path.join(output_dir, "er-diagram.dot")
    png_path = os.path.join(output_dir, "er-diagram.png")

    # Write DOT file
    with open(dot_path, "w", encoding="utf-8") as f:
        f.write(DOT_CONTENT)
    print(f"DOT file written: {dot_path}")

    # Find dot.exe
    dot_exe = r"C:\Program Files\Graphviz\bin\dot.exe"
    if not os.path.exists(dot_exe):
        raise FileNotFoundError(f"Graphviz dot.exe not found at {dot_exe}")

    # Render PNG
    cmd = [dot_exe, "-Tpng", "-Gdpi=200", "-o", png_path, dot_path]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr}")
        raise RuntimeError(f"Graphviz failed with code {result.returncode}")

    print(f"ER Diagram saved: {png_path}")
    file_size = os.path.getsize(png_path)
    print(f"File size: {file_size:,} bytes")

if __name__ == "__main__":
    main()
