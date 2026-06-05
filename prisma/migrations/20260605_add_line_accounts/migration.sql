-- CreateTable
CREATE TABLE "LineAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LineAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill existing one-to-one LINE links.
INSERT INTO "LineAccount" ("id", "lineUserId", "userId", "createdAt", "updatedAt")
SELECT 'line_' || "id", "lineUserId", "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "lineUserId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LineAccount_lineUserId_key" ON "LineAccount"("lineUserId");

-- CreateIndex
CREATE INDEX "LineAccount_userId_idx" ON "LineAccount"("userId");
