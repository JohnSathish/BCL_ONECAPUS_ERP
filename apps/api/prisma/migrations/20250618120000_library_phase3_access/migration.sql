-- Smart Library Phase 3 — QR entry, reading zones, self check-in

ALTER TABLE "library"."library_settings"
  ADD COLUMN IF NOT EXISTS "qr_entry_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "self_check_in_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "zones_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "library"."library_reading_zones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_seats" INTEGER NOT NULL DEFAULT 50,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_reading_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_reading_zones_tenant_id_code_key"
  ON "library"."library_reading_zones"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "library_reading_zones_tenant_id_active_idx"
  ON "library"."library_reading_zones"("tenant_id", "active");

ALTER TABLE "library"."library_visits"
  ADD COLUMN IF NOT EXISTS "zone_id" UUID,
  ADD COLUMN IF NOT EXISTS "seat_label" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_method" TEXT;

CREATE INDEX IF NOT EXISTS "library_visits_tenant_id_zone_id_exit_at_idx"
  ON "library"."library_visits"("tenant_id", "zone_id", "exit_at");

ALTER TABLE "library"."library_visits"
  ADD CONSTRAINT "library_visits_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "library"."library_reading_zones"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
