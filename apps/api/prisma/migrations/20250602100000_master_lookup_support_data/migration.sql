-- Extend master_lookups for Support Data metadata, campus scope, archive

ALTER TABLE "core"."master_lookups" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "core"."master_lookups" ADD COLUMN IF NOT EXISTS "campus_id" UUID;
ALTER TABLE "core"."master_lookups" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "master_lookups_tenant_id_lookup_type_campus_id_idx"
  ON "core"."master_lookups"("tenant_id", "lookup_type", "campus_id");
