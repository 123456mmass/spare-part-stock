import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePartFromCode } from "@/lib/part-lookup";
import {
  verifyLineSignature,
  sendLineReply,
  type LineWebhookBody,
} from "@/lib/line";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    if (!signature) {
      return NextResponse.json({ message: "Missing signature" }, { status: 401 });
    }

    if (!verifyLineSignature(body, signature)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
    }

    const parsed = JSON.parse(body) as LineWebhookBody;
    const events = parsed.events || [];

    for (const event of events) {
      if (event.type !== "message" || event.message?.type !== "text") continue;

      const replyToken = event.replyToken;
      if (!replyToken) continue;

      const text = (event.message?.text || "").trim();
      const reply = await handleCommand(text);

      await sendLineReply(replyToken, [{ type: "text", text: reply }]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCommand(text: string): Promise<string> {
  const trimmed = text.trim();
  const command = trimmed.toLowerCase();

  const stockMatch = trimmed.match(/^stock\s+(.+)$/i);
  if (stockMatch) {
    return lookupPart(stockMatch[1].trim());
  }

  const searchMatch = trimmed.match(/^(?:ค้นหา|search)\s+(.+)$/i);
  if (searchMatch) {
    return searchParts(searchMatch[1].trim());
  }

  if (command === "help" || command === "ช่วยเหลือ") {
    return helpText();
  }

  if (trimmed.length >= 3 && trimmed.length <= 100) {
    return lookupPart(trimmed);
  }

  return helpText();
}

async function lookupPart(code: string): Promise<string> {
  const part = await resolvePartFromCode(code);

  if (!part) {
    return `ไม่พบ "${code}" ในระบบ`;
  }

  const status = part.quantity <= 0
    ? "หมด"
    : part.quantity <= part.minimumQuantity
      ? "ต่ำกว่าขั้นต่ำ"
      : "คงเหลือ";

  return [
    `อะไหล่: ${part.partName}`,
    `รหัส: ${part.partNumber}`,
    `สถานที่: ${part.location || "-"}`,
    `จำนวน: ${part.quantity} ${part.unit || "pcs"}`,
    `ขั้นต่ำ: ${part.minimumQuantity}`,
    `สถานะ: ${status}`,
  ].join("\n");
}

async function searchParts(keyword: string): Promise<string> {
  const parts = await prisma.part.findMany({
    where: {
      isActive: true,
      OR: [
        { partNumber: { contains: keyword } },
        { partName: { contains: keyword } },
      ],
    },
    take: 5,
    orderBy: { partNumber: "asc" },
  });

  if (parts.length === 0) {
    return `ไม่พบอะไหล่ที่ตรงกับ "${keyword}"`;
  }

  const lines = parts.map(
    (p) => `- ${p.partNumber}: ${p.partName} (${p.quantity} ${p.unit || "pcs"})`
  );

  if (parts.length === 5) {
    lines.push("... พิมพ์คำค้นให้เจาะจงขึ้นเพื่อดูเพิ่มเติม");
  }

  return `ค้นหา "${keyword}":\n${lines.join("\n")}`;
}

function helpText(): string {
  return [
    "คำสั่ง:",
    "stock <รหัส> — ดูสถานะอะไหล่",
    "ค้นหา <คำ> — ค้นหาอะไหล่",
    "หรือส่งรหัส/บาร์โค้ดโดยตรง",
  ].join("\n");
}
