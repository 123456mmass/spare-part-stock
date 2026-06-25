-- Add tokenVersion column to User so existing JWT sessions can be invalidated
-- when a password is changed/reset or the account is deactivated.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
