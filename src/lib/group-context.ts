/**
 * Group rolling image context for LINE groups/rooms.
 *
 * ใน LINE group:
 * - ถ้า user ส่งรูปโดยไม่ @bot → bot เงียบ แต่เก็บรูปไว้ใน context
 * - ถ้า user @bot ด้วยข้อความเช่น "รูปนี้" → bot หา recent image จาก context
 *
 * Context config:
 * - เก็บเฉพาะ imageMessageId (ไม่เก็บ base64)
 * - เก็บสูงสุด 20 รูปต่อ group
 * - expire 24 ชั่วโมง
 * - prune ทุกครั้งหลัง insert
 */

import { prisma } from "@/lib/prisma";

// ── Config ───────────────────────────────────────────────────────────

const MAX_IMAGES_PER_GROUP = 20;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ───────────────────────────────────────────────────────────

export type GroupImageEntry = {
  id: string;
  groupId: string;
  imageMessageId: string;
  senderUserId: string;
  createdAt: Date;
};

// ── Store ────────────────────────────────────────────────────────────

/**
 * Store a group image reference and prune old entries.
 * Call this for EVERY image in a group, even when bot is not mentioned.
 */
export async function storeGroupImage(
  groupId: string,
  imageMessageId: string,
  senderUserId: string,
): Promise<void> {
  // Insert
  await prisma.groupImageContext.create({
    data: { groupId, imageMessageId, senderUserId },
  });

  // Prune: keep only latest MAX_IMAGES_PER_GROUP, delete expired
  await pruneGroupImages(groupId);
}

// ── Find recent ──────────────────────────────────────────────────────

/**
 * Find the most recent image sent by a specific user in the group.
 */
export async function findRecentImageForUser(
  groupId: string,
  senderUserId: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<GroupImageEntry | null> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const entry = await prisma.groupImageContext.findFirst({
    where: {
      groupId,
      senderUserId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return entry as GroupImageEntry | null;
}

/**
 * Find the most recent image in the group (any sender).
 */
export async function findRecentImageInGroup(
  groupId: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<GroupImageEntry | null> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const entry = await prisma.groupImageContext.findFirst({
    where: {
      groupId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
  });

  return entry as GroupImageEntry | null;
}

/**
 * Find recent images in the group (for selection when ambiguous).
 */
export async function findRecentImagesInGroup(
  groupId: string,
  limit: number = 4,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<GroupImageEntry[]> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  const entries = await prisma.groupImageContext.findMany({
    where: {
      groupId,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries as GroupImageEntry[];
}

/**
 * Count recent images in the group.
 */
export async function countRecentImagesInGroup(
  groupId: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  return prisma.groupImageContext.count({
    where: {
      groupId,
      createdAt: { gte: cutoff },
    },
  });
}

// ── Prune ────────────────────────────────────────────────────────────

/**
 * Delete images beyond MAX_IMAGES_PER_GROUP and expired images.
 */
async function pruneGroupImages(groupId: string): Promise<void> {
  const cutoff = new Date(Date.now() - DEFAULT_MAX_AGE_MS);

  // Delete expired
  await prisma.groupImageContext.deleteMany({
    where: {
      groupId,
      createdAt: { lt: cutoff },
    },
  });

  // Find IDs of oldest images beyond the limit
  const excess = await prisma.groupImageContext.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    skip: MAX_IMAGES_PER_GROUP,
    select: { id: true },
  });

  if (excess.length > 0) {
    await prisma.groupImageContext.deleteMany({
      where: { id: { in: excess.map((e) => e.id) } },
    });
  }
}
