CREATE TABLE "AiPendingAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "conversationId" TEXT,
  "actionType" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" DATETIME,
  "executedAt" DATETIME,
  "errorMessage" TEXT,
  CONSTRAINT "AiPendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AiPendingAction_userId_status_idx" ON "AiPendingAction"("userId", "status");
CREATE INDEX "AiPendingAction_conversationId_idx" ON "AiPendingAction"("conversationId");
CREATE INDEX "AiPendingAction_expiresAt_idx" ON "AiPendingAction"("expiresAt");
CREATE INDEX "AiPendingAction_createdAt_idx" ON "AiPendingAction"("createdAt");
