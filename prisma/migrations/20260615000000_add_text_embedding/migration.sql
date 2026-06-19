-- Add text embedding support for hybrid semantic search
ALTER TABLE "Part" ADD COLUMN "textEmbedding" BLOB;
