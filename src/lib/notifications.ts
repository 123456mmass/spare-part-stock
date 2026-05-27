import { prisma } from "./prisma";
import { pushLineMessage } from "./line";

/**
 * Check part stock after a movement and push LINE notification
 * to linked users if quantity <= minimumQuantity.
 * Fires-and-forgets: errors are logged but not thrown.
 */
export async function notifyLowStock(partId: string): Promise<void> {
  try {
    const part = await prisma.part.findUnique({
      where: { id: partId },
      select: {
        partNumber: true,
        partName: true,
        quantity: true,
        minimumQuantity: true,
      },
    });

    if (!part || part.quantity > part.minimumQuantity) return;

    const users = await prisma.user.findMany({
      where: {
        lineUserId: { not: null },
        isActive: true,
      },
      select: { lineUserId: true },
    });

    const status = part.quantity <= 0 ? "หมด" : "ต่ำกว่าขั้นต่ำ";
    const text = [
      `แจ้งเตือน: ${status}`,
      `อะไหล่: ${part.partName}`,
      `รหัส: ${part.partNumber}`,
      `คงเหลือ: ${part.quantity}`,
      `ขั้นต่ำ: ${part.minimumQuantity}`,
    ].join("\n");

    for (const user of users) {
      if (user.lineUserId) {
        await pushLineMessage(user.lineUserId, [{ type: "text", text }]);
      }
    }
  } catch (error) {
    console.error("notifyLowStock error:", error);
  }
}
