import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createStockMovement } from "@/lib/stock";
import { notifyLowStock } from "@/lib/notifications";
import { partSchema } from "@/lib/validators";
import type { AiAssistantChannel, ToolExecutionContext } from "./types";

const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

const stockInOutPayloadSchema = z.object({
  partNumber: z.string().min(1),
  qty: z.coerce.number().int().min(1),
  note: z.string().optional(),
});

const adjustPayloadSchema = z.object({
  partNumber: z.string().min(1),
  newQty: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

const locationPayloadSchema = z.object({
  partNumber: z.string().min(1),
  location: z.string().min(1),
  note: z.string().optional(),
});

const createPartPayloadSchema = partSchema.extend({
  note: z.string().optional(),
});

export type PendingActionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "EXECUTED"
  | "FAILED";

export type PendingActionType =
  | "stock_in"
  | "stock_out"
  | "adjust_stock"
  | "update_part_location"
  | "create_part";

function parsePayload(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson) as unknown;
  } catch {
    return {};
  }
}

function shortCode(id: string): string {
  return id.slice(-6).toUpperCase();
}

function requireAdmin(role: string, actionType: PendingActionType) {
  if (role !== "ADMIN") {
    throw new Error(`${actionType} ต้องใช้สิทธิ์ ADMIN`);
  }
}

async function resolveActivePart(partNumber: string) {
  const lookupTerms = buildPartLookupTerms(partNumber);

  const exactPart = await prisma.part.findFirst({
    where: {
      isActive: true,
      OR: lookupTerms.flatMap((term) => [
        { partNumber: term },
        { barcodeValue: term },
      ]),
    },
    include: {
      building: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { partNumber: "asc" },
  });
  if (exactPart) return exactPart;

  const part = await prisma.part.findFirst({
    where: {
      isActive: true,
      OR: lookupTerms.flatMap((term) => [
        { partNumber: { contains: term } },
        { barcodeValue: { contains: term } },
        { partName: { contains: term } },
      ]),
    },
    include: {
      building: { select: { name: true } },
      category: { select: { name: true } },
    },
    orderBy: { partNumber: "asc" },
  });

  if (!part) throw new Error(`ไม่พบอะไหล่ "${partNumber}"`);
  return part;
}

function buildPartLookupTerms(input: string): string[] {
  const cleaned = input.trim();
  const terms = new Set<string>();
  if (cleaned) terms.add(cleaned);

  const codeMatches = cleaned.match(/[A-Z0-9][A-Z0-9._/-]{2,}/gi) || [];
  for (const match of codeMatches) {
    const code = match.replace(/^[._/-]+|[._/-]+$/g, "");
    if (code.length >= 3 && /\d/.test(code)) terms.add(code);
  }

  return [...terms].slice(0, 8);
}

export async function createPendingAction(params: {
  context: ToolExecutionContext;
  actionType: PendingActionType;
  payload: unknown;
  summary: string;
}) {
  const action = await prisma.aiPendingAction.create({
    data: {
      userId: params.context.user.id,
      channel: params.context.channel,
      conversationId: params.context.conversationId,
      actionType: params.actionType,
      payloadJson: JSON.stringify(params.payload),
      summary: params.summary,
      expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS),
    },
  });

  return {
    ...action,
    code: shortCode(action.id),
  };
}

export async function draftStockIn(
  context: ToolExecutionContext,
  raw: unknown,
) {
  const payload = stockInOutPayloadSchema.parse(raw);
  const part = await resolveActivePart(payload.partNumber);
  return createPendingAction({
    context,
    actionType: "stock_in",
    payload: { ...payload, partId: part.id },
    summary: `รับเข้า ${part.partNumber} - ${part.partName} จำนวน ${payload.qty} ${part.unit || "pcs"}${payload.note ? ` (${payload.note})` : ""}`,
  });
}

export async function draftStockOut(
  context: ToolExecutionContext,
  raw: unknown,
) {
  const payload = stockInOutPayloadSchema.parse(raw);
  const part = await resolveActivePart(payload.partNumber);
  if (part.quantity < payload.qty) {
    throw new Error(
      `จำนวนไม่พอ คงเหลือ ${part.quantity} ${part.unit || "pcs"}`,
    );
  }
  return createPendingAction({
    context,
    actionType: "stock_out",
    payload: { ...payload, partId: part.id },
    summary: `เบิกออก ${part.partNumber} - ${part.partName} จำนวน ${payload.qty} ${part.unit || "pcs"}${payload.note ? ` (${payload.note})` : ""}`,
  });
}

export async function draftAdjustStock(
  context: ToolExecutionContext,
  raw: unknown,
) {
  requireAdmin(context.user.role, "adjust_stock");
  const payload = adjustPayloadSchema.parse(raw);
  const part = await resolveActivePart(payload.partNumber);
  return createPendingAction({
    context,
    actionType: "adjust_stock",
    payload: { ...payload, partId: part.id },
    summary: `ปรับยอด ${part.partNumber} - ${part.partName} เป็น ${payload.newQty} ${part.unit || "pcs"}${payload.note ? ` (${payload.note})` : ""}`,
  });
}

export async function draftUpdatePartLocation(
  context: ToolExecutionContext,
  raw: unknown,
) {
  requireAdmin(context.user.role, "update_part_location");
  const payload = locationPayloadSchema.parse(raw);
  const part = await resolveActivePart(payload.partNumber);
  return createPendingAction({
    context,
    actionType: "update_part_location",
    payload: { ...payload, partId: part.id },
    summary: `แก้ตำแหน่ง ${part.partNumber} - ${part.partName} เป็น "${payload.location}"${payload.note ? ` (${payload.note})` : ""}`,
  });
}

export async function draftCreatePart(
  context: ToolExecutionContext,
  raw: unknown,
) {
  requireAdmin(context.user.role, "create_part");
  const payload = createPartPayloadSchema.parse(raw);
  const existing = await prisma.part.findUnique({
    where: { partNumber: payload.partNumber },
  });
  if (existing) throw new Error(`มีรหัสอะไหล่ ${payload.partNumber} อยู่แล้ว`);

  return createPendingAction({
    context,
    actionType: "create_part",
    payload,
    summary: `สร้างอะไหล่ใหม่ ${payload.partNumber} - ${payload.partName} จำนวนเริ่มต้น ${payload.quantity} ${payload.unit}`,
  });
}

export async function findPendingActionByCode(userId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  const actions = await prisma.aiPendingAction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return actions.find((action) => shortCode(action.id) === normalized) || null;
}

export async function cancelPendingAction(params: {
  id: string;
  userId: string;
}) {
  const action = await prisma.aiPendingAction.findFirst({
    where: { id: params.id, userId: params.userId },
  });
  if (!action) throw new Error("ไม่พบรายการที่รอยืนยัน");
  if (action.status !== "PENDING") return action;

  return prisma.aiPendingAction.update({
    where: { id: action.id },
    data: { status: "CANCELLED" },
  });
}

export async function cancelPendingActionByCode(userId: string, code: string) {
  const action = await findPendingActionByCode(userId, code);
  if (!action) throw new Error("ไม่พบรายการที่รอยืนยัน");
  return cancelPendingAction({ id: action.id, userId });
}

export async function confirmPendingAction(params: {
  id: string;
  userId: string;
  channel?: AiAssistantChannel;
}) {
  const action = await prisma.aiPendingAction.findFirst({
    where: { id: params.id, userId: params.userId },
    include: { user: true },
  });
  if (!action) throw new Error("ไม่พบรายการที่รอยืนยัน");
  if (action.status === "EXECUTED")
    return { action, message: "รายการนี้ทำสำเร็จแล้ว" };
  if (action.status !== "PENDING")
    throw new Error(`รายการนี้อยู่ในสถานะ ${action.status}`);
  if (action.expiresAt.getTime() < Date.now()) {
    const expired = await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: "EXPIRED" },
      include: { user: true },
    });
    throw new Error(`รายการหมดอายุแล้ว: ${expired.summary}`);
  }

  const claimed = await prisma.aiPendingAction.updateMany({
    where: { id: action.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (claimed.count === 0) {
    const latest = await prisma.aiPendingAction.findUnique({
      where: { id: action.id },
    });
    if (latest?.status === "EXECUTED")
      return { action: latest, message: "รายการนี้ทำสำเร็จแล้ว" };
    throw new Error(`รายการนี้อยู่ในสถานะ ${latest?.status || "UNKNOWN"}`);
  }

  try {
    const result = await executePendingAction(action);
    const executed = await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: "EXECUTED", executedAt: new Date() },
      include: { user: true },
    });
    return { action: executed, message: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

export async function confirmPendingActionByCode(userId: string, code: string) {
  const action = await findPendingActionByCode(userId, code);
  if (!action) throw new Error("ไม่พบรายการที่รอยืนยัน");
  return confirmPendingAction({ id: action.id, userId });
}

async function executePendingAction(action: {
  id: string;
  userId: string;
  actionType: string;
  payloadJson: string;
  user: { role: string };
}) {
  const payload = parsePayload(action.payloadJson);

  if (action.actionType === "stock_in" || action.actionType === "stock_out") {
    const parsed = stockInOutPayloadSchema
      .extend({ partId: z.string().min(1) })
      .parse(payload);
    const movement = await createStockMovement({
      partId: parsed.partId,
      userId: action.userId,
      type: action.actionType === "stock_in" ? "STOCK_IN" : "STOCK_OUT",
      quantity: parsed.qty,
      note: parsed.note,
    });
    await notifyLowStock(parsed.partId);
    return `ทำรายการสำเร็จ: ${movement.part.partNumber} คงเหลือ ${movement.quantityAfter}`;
  }

  if (action.actionType === "adjust_stock") {
    requireAdmin(action.user.role, "adjust_stock");
    const parsed = adjustPayloadSchema
      .extend({ partId: z.string().min(1) })
      .parse(payload);
    const movement = await createStockMovement({
      partId: parsed.partId,
      userId: action.userId,
      type: "ADJUSTMENT",
      quantity: parsed.newQty,
      note: parsed.note,
    });
    await notifyLowStock(parsed.partId);
    return `ปรับยอดสำเร็จ: ${movement.part.partNumber} คงเหลือ ${movement.quantityAfter}`;
  }

  if (action.actionType === "update_part_location") {
    requireAdmin(action.user.role, "update_part_location");
    const parsed = locationPayloadSchema
      .extend({ partId: z.string().min(1) })
      .parse(payload);
    const part = await prisma.part.update({
      where: { id: parsed.partId },
      data: { location: parsed.location },
      select: { partNumber: true, partName: true, location: true },
    });
    return `แก้ตำแหน่งสำเร็จ: ${part.partNumber} - ${part.partName} อยู่ที่ ${part.location}`;
  }

  if (action.actionType === "create_part") {
    requireAdmin(action.user.role, "create_part");
    const parsed = createPartPayloadSchema.parse(payload);
    const part = await prisma.part.create({
      data: {
        partNumber: parsed.partNumber,
        partName: parsed.partName,
        description: parsed.description,
        categoryId: parsed.categoryId,
        buildingId: parsed.buildingId,
        subcategory: parsed.subcategory,
        plant: parsed.plant,
        location: parsed.location,
        quantity: parsed.quantity,
        minimumQuantity: parsed.minimumQuantity,
        unit: parsed.unit,
        barcodeValue: parsed.barcodeValue,
        createdBy: action.userId,
      },
      select: { partNumber: true, partName: true, quantity: true, unit: true },
    });
    return `สร้างอะไหล่สำเร็จ: ${part.partNumber} - ${part.partName} จำนวน ${part.quantity} ${part.unit}`;
  }

  throw new Error(`ไม่รองรับ action type ${action.actionType}`);
}

export function formatPendingActionForChat(action: {
  id: string;
  summary: string;
  expiresAt: Date;
}) {
  const code = shortCode(action.id);
  return [
    `ต้องยืนยันก่อนทำรายการ`,
    action.summary,
    `รหัสยืนยัน: ${code}`,
    `พิมพ์ "ยืนยัน ${code}" เพื่อทำรายการ หรือ "ยกเลิก ${code}" เพื่อยกเลิก`,
  ].join("\n");
}

export function pendingActionCode(id: string) {
  return shortCode(id);
}
