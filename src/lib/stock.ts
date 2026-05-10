import { prisma } from "./prisma";

export interface StockMovementResult {
  id: string;
  partId: string;
  userId: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantityBefore: number;
  quantityAfter: number;
  quantityChange: number;
  note: string | null;
  createdAt: Date;
  part: { partNumber: string; partName: string; quantity: number };
  user: { name: string };
}

export class StockError extends Error {
  constructor(
    message: "PART_NOT_FOUND" | "INSUFFICIENT_STOCK" | "NEGATIVE_STOCK"
  ) {
    super(message);
    this.name = "StockError";
  }
}

export async function createStockMovement(params: {
  partId: string;
  userId: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantity: number;
  note?: string;
}): Promise<StockMovementResult> {
  const { partId, userId, type, quantity, note } = params;

  return prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({ where: { id: partId } });

    if (!part) {
      throw new StockError("PART_NOT_FOUND");
    }

    const quantityBefore = part.quantity;
    let quantityAfter = part.quantity;
    let quantityChange = 0;

    if (type === "STOCK_IN") {
      quantityAfter = part.quantity + quantity;
      quantityChange = quantity;
    } else if (type === "STOCK_OUT") {
      if (part.quantity < quantity) {
        throw new StockError("INSUFFICIENT_STOCK");
      }
      quantityAfter = part.quantity - quantity;
      quantityChange = -quantity;
    } else if (type === "ADJUSTMENT") {
      quantityAfter = quantity;
      quantityChange = quantity - part.quantity;
    }

    if (quantityAfter < 0) {
      throw new StockError("NEGATIVE_STOCK");
    }

    const [movement] = await Promise.all([
      tx.stockMovement.create({
        data: {
          partId,
          userId,
          type,
          quantityBefore,
          quantityAfter,
          quantityChange,
          note,
        },
        include: {
          part: { select: { partNumber: true, partName: true, quantity: true } },
          user: { select: { name: true } },
        },
      }),
      tx.part.update({
        where: { id: partId },
        data: { quantity: quantityAfter },
      }),
    ]);

    return movement as StockMovementResult;
  });
}
