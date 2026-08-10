-- AlterTable
ALTER TABLE "academic"."website_notices" ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]';
