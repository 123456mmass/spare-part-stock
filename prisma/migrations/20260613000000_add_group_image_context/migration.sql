-- Migration: add GroupImageContext, User.lineUserId, and their indexes.
--
-- IMPORTANT — DESTRUCTIVE REDEFINES REMOVED:
--   The original prisma migrate diff generated table redefines for Part and
--   ConversationMessage (DROP + recreate + INSERT…SELECT). These have been
--   intentionally removed because:
--
--   1. This project uses `prisma db push` as the primary schema sync method;
--      the production DB already has every column and FK constraint matching
--      schema.prisma, including subcategory, plant, createdBy, imageEmbedding,
--      imageEmbeddingProvider, imageEmbeddingModel, imageEmbeddingDimension,
--      messageType, metadata, and ON UPDATE CASCADE.
--
--   2. Dropping and recreating Part is dangerous: any mismatch in the SELECT
--      column list causes silent data loss. On a DB pushed from schema.prisma,
--      the redefine is pure risk with zero benefit.
--
--   3. ConversationMessage also exists with the correct schema from the initial
--      migration (20260602_add_conversation_tables) or from db push.
--
-- If you are running this migration on a DB that was *never* db-pushed (pure
-- migration history only), use scripts/prod-schema-reconcile.sh first to fill
-- any missing additive columns before deploying.
--
-- This file now contains ONLY additive operations that are safe to re-run.

-- AlterTable: add lineUserId to User (used for LINE account linking).
-- SQLite does not support ADD COLUMN IF NOT EXISTS; if this column already
-- exists on your DB, use prod-schema-reconcile.sh --apply before running
-- prisma migrate deploy, then resolve this migration as already applied.
ALTER TABLE "User" ADD COLUMN "lineUserId" TEXT;

-- CreateTable: tracks recent images in LINE group chats for @bot image search.
CREATE TABLE IF NOT EXISTS "GroupImageContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "imageMessageId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS "GroupImageContext_groupId_createdAt_idx" ON "GroupImageContext"("groupId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "User_lineUserId_key" ON "User"("lineUserId");
