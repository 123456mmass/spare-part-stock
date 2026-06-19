"""
Generate ER Diagram for Spare Part Stock System using matplotlib.
Outputs: docs/images/er-diagram.png
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

fig, ax = plt.subplots(1, 1, figsize=(22, 16))
ax.set_xlim(0, 22)
ax.set_ylim(0, 16)
ax.axis("off")
fig.patch.set_facecolor("white")

# ── Style ──
TABLE_COLOR = "#E3F2FD"
TABLE_HEADER_COLOR = "#1565C0"
TABLE_HEADER_TEXT = "white"
PK_COLOR = "#FFF9C4"
FK_COLOR = "#E8F5E9"
ENUM_COLOR = "#F3E5F5"
RELATION_COLOR = "#37474F"
FONT = "Tahoma"
FONT_SMALL = 7.5
FONT_TABLE = 8
FONT_HEADER = 9.5
FONT_TITLE = 14

def draw_table(ax, x, y, name, fields, width=3.2, header_h=0.42, row_h=0.32):
    """Draw an ER table box. Returns (center_x, top_y, bottom_y, right_x)"""
    total_h = header_h + row_h * len(fields)

    # Shadow
    shadow = FancyBboxPatch((x + 0.04, y - total_h - 0.04), width, total_h,
                             boxstyle="round,pad=0.06", facecolor="#B0BEC5", edgecolor="none", alpha=0.3)
    ax.add_patch(shadow)

    # Main box
    box = FancyBboxPatch((x, y - total_h), width, total_h,
                          boxstyle="round,pad=0.06", facecolor="white", edgecolor="#90A4AE", linewidth=1.2)
    ax.add_patch(box)

    # Header
    header = FancyBboxPatch((x, y - header_h), width, header_h,
                             boxstyle="round,pad=0.06", facecolor=TABLE_HEADER_COLOR, edgecolor="none")
    ax.add_patch(header)
    ax.text(x + width / 2, y - header_h / 2, name, ha="center", va="center",
            fontsize=FONT_HEADER, fontweight="bold", color=TABLE_HEADER_TEXT, fontfamily=FONT)

    # Fields
    cy = y - header_h
    for i, (fname, ftype, fkey) in enumerate(fields):
        cy -= row_h
        # Alternate row bg
        if i % 2 == 0:
            row_bg = FancyBboxPatch((x + 0.02, cy - row_h / 2 + 0.01), width - 0.04, row_h - 0.02,
                                     boxstyle="round,pad=0.02", facecolor="#F5F5F5", edgecolor="none")
            ax.add_patch(row_bg)

        # Key icon color
        if fkey == "PK":
            dot_color = "#F9A825"
        elif fkey == "FK":
            dot_color = "#43A047"
        elif fkey == "UQ":
            dot_color = "#7E57C2"
        else:
            dot_color = "none"

        if dot_color != "none":
            ax.plot(x + 0.18, cy, "o", color=dot_color, markersize=4, zorder=5)

        label = fname
        if fkey:
            label = f"{fname}"
            ax.text(x + 0.32, cy, label, ha="left", va="center",
                    fontsize=FONT_TABLE, fontfamily=FONT, color="#212121")
        else:
            ax.text(x + 0.18, cy, label, ha="left", va="center",
                    fontsize=FONT_TABLE, fontfamily=FONT, color="#424242")

        # Type on right
        ax.text(x + width - 0.15, cy, ftype, ha="right", va="center",
                fontsize=FONT_SMALL, fontfamily=FONT, color="#757575", fontstyle="italic")

    center_x = x + width / 2
    return center_x, y, y - total_h, x + width

# ── Table definitions ──
# (field_name, type, key_type)  key_type: PK, FK, UQ, or ""

tables = {}

tables["User"] = draw_table(ax, 1, 15.3, "User", [
    ("id", "String", "PK"),
    ("username", "String", "UQ"),
    ("password", "String", ""),
    ("name", "String", ""),
    ("role", "ADMIN|STAFF", ""),
    ("isActive", "Boolean", ""),
    ("mustChangePassword", "Boolean", ""),
    ("lineUserId", "String?", "UQ"),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=3.0)

tables["LineAccount"] = draw_table(ax, 5, 15.3, "LineAccount", [
    ("id", "String", "PK"),
    ("lineUserId", "String", "UQ"),
    ("userId", "String", "FK"),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=2.8)

tables["Category"] = draw_table(ax, 9.5, 15.3, "Category", [
    ("id", "String", "PK"),
    ("name", "String", "UQ"),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=2.5)

tables["Building"] = draw_table(ax, 13, 15.3, "Building", [
    ("id", "String", "PK"),
    ("name", "String", "UQ"),
    ("sortOrder", "Int", ""),
    ("isActive", "Boolean", ""),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=2.5)

tables["Part"] = draw_table(ax, 9.2, 11.5, "Part", [
    ("id", "String", "PK"),
    ("partNumber", "String", "UQ"),
    ("partName", "String", ""),
    ("description", "String?", ""),
    ("categoryId", "String?", "FK"),
    ("buildingId", "String?", "FK"),
    ("subcategory", "String?", ""),
    ("plant", "String?", ""),
    ("location", "String?", ""),
    ("quantity", "Int", ""),
    ("minimumQuantity", "Int", ""),
    ("unit", "String", ""),
    ("imageUrl", "String?", ""),
    ("imageEmbedding", "Bytes?", ""),
    ("textEmbedding", "Bytes?", ""),
    ("qrCodeUrl", "String?", ""),
    ("barcodeValue", "String?", "UQ"),
    ("isActive", "Boolean", ""),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=3.2)

tables["StockMovement"] = draw_table(ax, 14, 7.5, "StockMovement", [
    ("id", "String", "PK"),
    ("partId", "String", "FK"),
    ("userId", "String", "FK"),
    ("type", "IN|OUT|ADJ", ""),
    ("quantityBefore", "Int", ""),
    ("quantityAfter", "Int", ""),
    ("quantityChange", "Int", ""),
    ("note", "String?", ""),
    ("createdAt", "DateTime", ""),
], width=2.8)

tables["Conversation"] = draw_table(ax, 0.5, 7.5, "Conversation", [
    ("id", "String", "PK"),
    ("lineUserId", "String?", ""),
    ("lineGroupId", "String?", ""),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=2.8)

tables["ConversationMessage"] = draw_table(ax, 4.5, 4.5, "ConversationMessage", [
    ("id", "String", "PK"),
    ("conversationId", "String", "FK"),
    ("role", "String", ""),
    ("content", "String", ""),
    ("messageType", "String", ""),
    ("metadata", "String?", ""),
    ("createdAt", "DateTime", ""),
], width=3.0)

tables["AiPendingAction"] = draw_table(ax, 0.5, 4.2, "AiPendingAction", [
    ("id", "String", "PK"),
    ("userId", "String", "FK"),
    ("channel", "String", ""),
    ("conversationId", "String?", ""),
    ("actionType", "String", ""),
    ("payloadJson", "String", ""),
    ("summary", "String", ""),
    ("status", "String", ""),
    ("expiresAt", "DateTime", ""),
    ("createdAt", "DateTime", ""),
], width=3.0)

tables["GroupImageContext"] = draw_table(ax, 8, 3.5, "GroupImageContext", [
    ("id", "String", "PK"),
    ("groupId", "String", ""),
    ("imageMessageId", "String", ""),
    ("senderUserId", "String", ""),
    ("createdAt", "DateTime", ""),
], width=2.8)

tables["AppSetting"] = draw_table(ax, 12, 3.5, "AppSetting", [
    ("key", "String", "PK"),
    ("value", "String", ""),
    ("category", "String?", ""),
    ("createdAt", "DateTime", ""),
    ("updatedAt", "DateTime", ""),
], width=2.5)

# ── Draw relationships ──
def draw_relation(ax, x1, y1, x2, y2, label1="1", label2="N", style="-", color=RELATION_COLOR, curved=False):
    """Draw a relationship line between two points with cardinality labels."""
    if curved:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                     arrowprops=dict(arrowstyle="-", color=color, lw=1.3,
                                     connectionstyle="arc3,rad=0.15"))
    else:
        ax.plot([x1, x2], [y1, y2], style, color=color, lw=1.3, zorder=1)

    # Cardinality labels
    offset = 0.2
    dx = x2 - x1
    dy = y2 - y1
    length = max((dx**2 + dy**2) ** 0.5, 0.01)
    ux, uy = dx / length, dy / length

    ax.text(x1 + ux * offset + 0.1, y1 + uy * offset, label1,
            fontsize=8, fontweight="bold", color=color, ha="center", va="center", fontfamily=FONT)
    ax.text(x2 - ux * offset - 0.1, y2 - uy * offset, label2,
            fontsize=8, fontweight="bold", color=color, ha="center", va="center", fontfamily=FONT)

# User 1:N LineAccount
u_cx, u_top, u_bot, u_right = tables["User"]
la_cx, la_top, la_bot, la_right = tables["LineAccount"]
draw_relation(ax, u_right, 13.8, la_cx - 1.4 + 0.0, 14.0, "1", "N")

# User 1:N StockMovement
u_cx, u_top, u_bot, u_right = tables["User"]
sm_cx, sm_top, sm_bot, sm_right = tables["StockMovement"]
draw_relation(ax, u_right, u_bot + 0.5, sm_cx - 1.4, sm_top - 0.3, "1", "N", curved=True)

# User 1:N AiPendingAction
u_cx, u_top, u_bot, u_right = tables["User"]
apa_cx, apa_top, apa_bot, apa_right = tables["AiPendingAction"]
draw_relation(ax, u_cx - 1.5, u_bot + 0.3, apa_cx + 1.5, apa_top, "1", "N")

# Category 1:N Part
cat_cx, cat_top, cat_bot, cat_right = tables["Category"]
p_cx, p_top, p_bot, p_right = tables["Part"]
draw_relation(ax, cat_cx, cat_bot, p_cx + 0.5, p_top, "1", "N")

# Building 1:N Part
bld_cx, bld_top, bld_bot, bld_right = tables["Building"]
draw_relation(ax, bld_cx - 1.25, bld_bot, p_cx + 1.6, p_top, "1", "N")

# Part 1:N StockMovement
p_cx, p_top, p_bot, p_right = tables["Part"]
sm_cx, sm_top, sm_bot, sm_right = tables["StockMovement"]
draw_relation(ax, p_right, p_bot - 2.0, sm_cx - 1.4, sm_top, "1", "N")

# Conversation 1:N ConversationMessage
conv_cx, conv_top, conv_bot, conv_right = tables["Conversation"]
cm_cx, cm_top, cm_bot, cm_right = tables["ConversationMessage"]
draw_relation(ax, conv_cx, conv_bot, cm_cx, cm_top, "1", "N")

# ── Legend ──
legend_x, legend_y = 16.5, 15.5
ax.text(legend_x, legend_y, "สัญลักษณ์", fontsize=10, fontweight="bold", fontfamily=FONT, color="#212121")
# PK
ax.plot(legend_x + 0.15, legend_y - 0.4, "o", color="#F9A825", markersize=5)
ax.text(legend_x + 0.35, legend_y - 0.4, "= Primary Key (PK)", fontsize=8, fontfamily=FONT, va="center", color="#424242")
# FK
ax.plot(legend_x + 0.15, legend_y - 0.75, "o", color="#43A047", markersize=5)
ax.text(legend_x + 0.35, legend_y - 0.75, "= Foreign Key (FK)", fontsize=8, fontfamily=FONT, va="center", color="#424242")
# UQ
ax.plot(legend_x + 0.15, legend_y - 1.1, "o", color="#7E57C2", markersize=5)
ax.text(legend_x + 0.35, legend_y - 1.1, "= Unique (UQ)", fontsize=8, fontfamily=FONT, va="center", color="#424242")
# 1:N
ax.text(legend_x + 0.1, legend_y - 1.45, "1", fontsize=8, fontweight="bold", color=RELATION_COLOR, fontfamily=FONT)
ax.plot([legend_x + 0.25, legend_x + 0.6], [legend_y - 1.45, legend_y - 1.45], "-", color=RELATION_COLOR, lw=1.3)
ax.text(legend_x + 0.7, legend_y - 1.45, "N", fontsize=8, fontweight="bold", color=RELATION_COLOR, fontfamily=FONT)
ax.text(legend_x + 0.9, legend_y - 1.45, "= หนึ่งต่อกลาง (1:N)", fontsize=8, fontfamily=FONT, va="center", color="#424242")

# Optional relation note
ax.text(legend_x, legend_y - 1.9, "หมายเหตุ: เส้นประ = FK เป็นตัวเลือก (nullable)\n? หมายถึงฟิลด์เป็นตัวเลือก",
        fontsize=7.5, fontfamily=FONT, color="#757575", va="top", linespacing=1.5)

# Cascade delete note
ax.text(legend_x, legend_y - 2.6, "Cascade Delete:\n• User → LineAccount\n• User → AiPendingAction\n• Part → StockMovement\n• Conversation → ConversationMessage",
        fontsize=7, fontfamily=FONT, color="#90A4AE", va="top", linespacing=1.4)

# ── Title ──
ax.text(11, 15.8, "ER Diagram — ระบบจัดการสต็อกอะไหล่",
        ha="center", va="center", fontsize=FONT_TITLE, fontweight="bold",
        fontfamily=FONT, color="#1A237E")

plt.tight_layout()
plt.savefig("C:/spare-part-stock/docs/images/er-diagram.png", dpi=200, bbox_inches="tight", facecolor="white")
print("ER Diagram saved to docs/images/er-diagram.png")
