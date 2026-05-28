-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "buildingId" TEXT;

-- CreateIndex
CREATE INDEX "Part_buildingId_idx" ON "Part"("buildingId");
CREATE INDEX "Part_plant_idx" ON "Part"("plant");
