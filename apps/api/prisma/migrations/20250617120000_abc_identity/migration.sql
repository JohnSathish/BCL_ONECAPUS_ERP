-- ABC ID (Academic Bank of Credits) identity enhancements
ALTER TABLE "compliance"."abc_accounts"
  ADD COLUMN IF NOT EXISTS "abc_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verification_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "abc_accounts_tenant_id_abc_id_idx"
  ON "compliance"."abc_accounts"("tenant_id", "abc_id");

CREATE UNIQUE INDEX IF NOT EXISTS "abc_accounts_tenant_id_abc_id_unique"
  ON "compliance"."abc_accounts"("tenant_id", "abc_id")
  WHERE "abc_id" IS NOT NULL AND "deleted_at" IS NULL;
