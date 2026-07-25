-- ERP Academic Calendar foundation (bound 1:1 to AcademicYear)

CREATE TABLE IF NOT EXISTS "academic"."academic_calendars" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "weekend_days" JSONB NOT NULL DEFAULT '[0]',
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "academic_calendars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_calendars_academic_year_id_key"
  ON "academic"."academic_calendars"("academic_year_id");

CREATE INDEX IF NOT EXISTS "academic_calendars_tenant_id_institution_id_status_idx"
  ON "academic"."academic_calendars"("tenant_id", "institution_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."academic_calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "calendar_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "is_working_day" BOOLEAN,
    "creates_attendance_session" BOOLEAN NOT NULL DEFAULT false,
    "scope_type" TEXT NOT NULL DEFAULT 'INSTITUTION',
    "campus_id" UUID,
    "department_ids" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "source_module" TEXT,
    "source_ref_id" TEXT,
    "published_to_website" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "academic_calendar_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "academic_calendar_events_tenant_id_calendar_id_start_date_end_date_idx"
  ON "academic"."academic_calendar_events"("tenant_id", "calendar_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "academic_calendar_events_calendar_id_type_active_deleted_at_idx"
  ON "academic"."academic_calendar_events"("calendar_id", "type", "active", "deleted_at");

CREATE INDEX IF NOT EXISTS "academic_calendar_events_tenant_id_start_date_end_date_active_idx"
  ON "academic"."academic_calendar_events"("tenant_id", "start_date", "end_date", "active");

CREATE INDEX IF NOT EXISTS "academic_calendar_events_source_module_source_ref_id_idx"
  ON "academic"."academic_calendar_events"("source_module", "source_ref_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendars_institution_id_fkey'
  ) THEN
    ALTER TABLE "academic"."academic_calendars"
      ADD CONSTRAINT "academic_calendars_institution_id_fkey"
      FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendars_academic_year_id_fkey'
  ) THEN
    ALTER TABLE "academic"."academic_calendars"
      ADD CONSTRAINT "academic_calendars_academic_year_id_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_calendar_events_calendar_id_fkey'
  ) THEN
    ALTER TABLE "academic"."academic_calendar_events"
      ADD CONSTRAINT "academic_calendar_events_calendar_id_fkey"
      FOREIGN KEY ("calendar_id") REFERENCES "academic"."academic_calendars"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
