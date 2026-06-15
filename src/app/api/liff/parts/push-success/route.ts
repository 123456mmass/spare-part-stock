import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthFromRequest, AuthError } from "@/lib/auth";
import { pushLineMessage, createFlexMessage } from "@/lib/line";
import { createAddSuccessFlex, createSearchResultsFlex, type FlexPart } from "@/lib/line-chat/flex-messages";
import { searchPartsForLine, type LinePartSearchArgs } from "@/lib/line-chat/tools";
import { corsOptions, withCors } from "@/lib/cors";

export const OPTIONS = corsOptions();

export const POST = withCors(async (request: Request) => {
  try {
    const user = await requireAuthFromRequest(request);

    const body = await request.json() as { lineSid?: string; partId?: string };
    const { lineSid, partId } = body;

    if (!lineSid || !partId) {
      return NextResponse.json(
        { error: "ต้องระบุ lineSid และ partId" },
        { status: 400 },
      );
    }

    // Look up the part
    const part = await prisma.part.findUnique({
      where: { id: partId },
      include: { building: true, category: true },
    });

    if (!part) {
      return NextResponse.json(
        { error: "ไม่พบอะไหล่" },
        { status: 404 },
      );
    }

    // Resolve LINE userId for push message.
    // The image session may be in "saved" status, so we query the action
    // directly instead of using getImageSession which rejects non-PENDING.
    let lineUserId: string | null = null;
    const action = await prisma.aiPendingAction.findUnique({
      where: { id: lineSid },
      select: { userId: true },
    });

    if (action?.userId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: action.userId },
        select: { lineUserId: true },
      });
      lineUserId = dbUser?.lineUserId ?? null;
    }

    // Fallback: use the authenticated user's lineUserId
    if (!lineUserId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { lineUserId: true },
      });
      lineUserId = dbUser?.lineUserId ?? null;
    }

    if (!lineUserId) {
      return NextResponse.json(
        { error: "ไม่พบ LINE User ID สำหรับส่งข้อความ" },
        { status: 404 },
      );
    }

    // Build success Flex card
    const successFlex = createAddSuccessFlex(part.partNumber, part.partName);

    // Build search preview Flex card
    const keyword = part.partName || part.partNumber;
    const searchArgs: LinePartSearchArgs = { keyword, limit: 5 };
    const searchResults = await searchPartsForLine(searchArgs);
    const flexParts: FlexPart[] = searchResults.map((p) => ({
      id: p.id,
      partNumber: p.partNumber,
      partName: p.partName,
      quantity: p.quantity,
      minimumQuantity: p.minimumQuantity,
      unit: p.unit,
      plant: p.plant,
      imageUrl: p.imageUrl,
      building: p.building,
    }));

    const searchFlex = flexParts.length > 0
      ? createSearchResultsFlex(keyword, flexParts)
      : null;

    // Push messages to LINE
    const messages = [
      createFlexMessage("✅ เพิ่มอะไหล่สำเร็จ", successFlex),
    ];

    if (searchFlex) {
      messages.push(createFlexMessage(`ค้นหา "${keyword}"`, searchFlex));
    }

    await pushLineMessage(lineUserId, messages);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[push-success] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ" },
      { status: 500 },
    );
  }
});
