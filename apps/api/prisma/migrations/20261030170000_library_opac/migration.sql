ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "opac_settings" JSONB;

ALTER TABLE "library"."library_reservations"
  ALTER COLUMN "student_id" DROP NOT NULL;

ALTER TABLE "library"."library_reservations"
  ADD COLUMN IF NOT EXISTS "staff_profile_id" UUID;

CREATE INDEX IF NOT EXISTS "library_reservations_tenant_id_staff_profile_id_status_idx"
  ON "library"."library_reservations" ("tenant_id", "staff_profile_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_reservations_one_person'
  ) THEN
    ALTER TABLE "library"."library_reservations"
      ADD CONSTRAINT "library_reservations_one_person"
      CHECK (
        ("student_id" IS NOT NULL AND "staff_profile_id" IS NULL)
        OR ("student_id" IS NULL AND "staff_profile_id" IS NOT NULL)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "library"."library_opac_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "actor_id" UUID,
  "book_id" UUID,
  "query" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_opac_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_opac_events_tenant_id_kind_created_at_idx"
  ON "library"."library_opac_events" ("tenant_id", "kind", "created_at");

INSERT INTO "platform"."tenant_domains" ("id", "tenant_id", "host", "verified", "created_at", "updated_at")
SELECT gen_random_uuid(), "tenant_id", 'opac.donboscocollege.ac.in', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "platform"."tenant_domains"
WHERE "host" = 'erp.donboscocollege.ac.in' AND "deleted_at" IS NULL
ON CONFLICT ("host") DO NOTHING;
