-- Handbook-style academic year planner (month tables)
CREATE TABLE IF NOT EXISTS "academic"."website_academic_planner_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_academic_planner_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_academic_planner_years_site_id_slug_key"
  ON "academic"."website_academic_planner_years"("site_id", "slug");

CREATE INDEX IF NOT EXISTS "website_academic_planner_years_tenant_id_site_id_status_deleted_at_idx"
  ON "academic"."website_academic_planner_years"("tenant_id", "site_id", "status", "deleted_at");

CREATE TABLE IF NOT EXISTS "academic"."website_academic_planner_days" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "year_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status_label" TEXT NOT NULL DEFAULT 'Class',
    "description" TEXT NOT NULL DEFAULT '',
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "is_highlighted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_academic_planner_days_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "website_academic_planner_days_year_id_date_key"
  ON "academic"."website_academic_planner_days"("year_id", "date");

CREATE INDEX IF NOT EXISTS "website_academic_planner_days_tenant_id_site_id_date_idx"
  ON "academic"."website_academic_planner_days"("tenant_id", "site_id", "date");

CREATE INDEX IF NOT EXISTS "website_academic_planner_days_year_id_date_idx"
  ON "academic"."website_academic_planner_days"("year_id", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_academic_planner_years_site_id_fkey'
  ) THEN
    ALTER TABLE "academic"."website_academic_planner_years"
      ADD CONSTRAINT "website_academic_planner_years_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_academic_planner_days_site_id_fkey'
  ) THEN
    ALTER TABLE "academic"."website_academic_planner_days"
      ADD CONSTRAINT "website_academic_planner_days_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "academic"."website_sites"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'website_academic_planner_days_year_id_fkey'
  ) THEN
    ALTER TABLE "academic"."website_academic_planner_days"
      ADD CONSTRAINT "website_academic_planner_days_year_id_fkey"
      FOREIGN KEY ("year_id") REFERENCES "academic"."website_academic_planner_years"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
