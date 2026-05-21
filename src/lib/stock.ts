import { prisma } from "./prisma";

type StockDbClient = Pick<typeof prisma, "part" | "stockMovement">;

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
    message:
      | "PART_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "NEGATIVE_STOCK"
      | "CONCURRENT_MODIFICATION"
  ) {
    super(message);
    this.name = "StockError";
  }
}

async function createStockMovementWithClient(
  db: StockDbClient,
  params: {
  partId: string;
  userId: string;
  type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
  quantity: number;
  note?: string;
}
): Promise<StockMovementResult> {
  const { partId, userId, type, quantity, note } = params;

  const part = await db.part.findUnique({ where: { id: partId } });

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
    quantityAfter = part.quantity - quantity;
    quantityChange = -quantity;
  } else if (type === "ADJUSTMENT") {
    quantityAfter = quantity;
    quantityChange = quantity - part.quantity;
  }

  if (quantityAfter < 0) {
    throw type === "STOCK_OUT"
      ? new StockError("INSUFFICIENT_STOCK")
      : new StockError("NEGATIVE_STOCK");
  }

  // Atomic guarded update — refuses to write if quantity changed since we read it.
  const updated = await db.part.updateMany({
    where: { id: partId, quantity: quantityBefore },
    data: { quantity: quantityAfter },
  });

  if (updated.count === 0) {
    throw new StockError("CONCURRENT_MODIFICATION");
  }

  const movement = await db.stockMovement.create({
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
  });

  return movement as StockMovementResult;
}

export async function createStockMovement(
  params: {
    partId: string;
    userId: string;
    type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT";
    quantity: number;
    note?: string;
  },
  db?: StockDbClient
): Promise<StockMovementResult> {
  if (db) {
    return createStockMovementWithClient(db, params);
  }

  return prisma.$transaction(async (tx) => {
    return createStockMovementWithClient(tx, params);
  });
}
