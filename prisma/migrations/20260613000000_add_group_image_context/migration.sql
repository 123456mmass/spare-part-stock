-- AlterTable
ALTER TABLE "User" ADD COLUMN "lineUserId" TEXT;

-- CreateTable
CREATE TABLE "GroupImageContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "imageMessageId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ConversationMessage" ("content", "conversationId", "createdAt", "id", "messageType", "metadata", "role") SELECT "content", "conversationId", "createdAt", "id", "messageType", "metadata", "role" FROM "ConversationMessage";
DROP TABLE "ConversationMessage";
ALTER TABLE "new_ConversationMessage" RENAME TO "ConversationMessage";
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
CREATE TABLE "new_Part" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partNumber" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "buildingId" TEXT,
    "subcategory" TEXT,
    "plant" TEXT,
    "createdBy" TEXT,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minimumQuantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "imageUrl" TEXT,
    "imageEmbedding" BLOB,
    "imageEmbeddingProvider" TEXT,
    "imageEmbeddingModel" TEXT,
    "imageEmbeddingDimension" INTEGER,
    "qrCodeUrl" TEXT,
    "barcodeValue" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Part_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Part_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Part" ("barcodeValue", "buildingId", "categoryId", "createdAt", "description", "id", "imageEmbeddingDimension", "imageEmbeddingModel", "imageEmbeddingProvider", "imageUrl", "isActive", "location", "minimumQuantity", "partName", "partNumber", "qrCodeUrl", "quantity", "unit", "updatedAt") SELECT "barcodeValue", "buildingId", "categoryId", "createdAt", "description", "id", "imageEmbeddingDimension", "imageEmbeddingModel", "imageEmbeddingProvider", "imageUrl", "isActive", "location", "minimumQuantity", "partName", "partNumber", "qrCodeUrl", "quantity", "unit", "updatedAt" FROM "Part";
DROP TABLE "Part";
ALTER TABLE "new_Part" RENAME TO "Part";
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");
CREATE UNIQUE INDEX "Part_barcodeValue_key" ON "Part"("barcodeValue");
CREATE INDEX "Part_partNumber_idx" ON "Part"("partNumber");
CREATE INDEX "Part_categoryId_idx" ON "Part"("categoryId");
CREATE INDEX "Part_buildingId_idx" ON "Part"("buildingId");
CREATE INDEX "Part_location_idx" ON "Part"("location");
CREATE INDEX "Part_partName_idx" ON "Part"("partName");
CREATE INDEX "Part_plant_idx" ON "Part"("plant");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GroupImageContext_groupId_createdAt_idx" ON "GroupImageContext"("groupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_lineUserId_key" ON "User"("lineUserId");
