ALTER TABLE "platform"."backup_retention_policies"
ADD COLUMN IF NOT EXISTS "keep_hours" INTEGER;

UPDATE "platform"."backup_retention_policies"
SET "keep_hours" = 48,
    "keep_days" = 2,
    "auto_cleanup_enabled" = true
WHERE "id" = 'singleton';
