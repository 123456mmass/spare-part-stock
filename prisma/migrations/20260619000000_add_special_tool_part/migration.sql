-- Add special-tool-part flag and migrate existing "Special Tool" plant labels

-- 1. Add the column (default false so existing rows stay non-special)
ALTER TABLE "Part" ADD COLUMN "isSpecialToolPart" BOOLEAN NOT NULL DEFAULT false;

-- 2. Normalize legacy uppercase/whitespace variants
UPDATE "Part" SET "plant" = '1' WHERE "plant" = 'BLOCK 1';

-- 3. Migrate every part whose plant indicates a shared/special tool part
UPDATE "Part"
SET "isSpecialToolPart" = true, "plant" = NULL
WHERE LOWER("plant") LIKE '%special tool%';
