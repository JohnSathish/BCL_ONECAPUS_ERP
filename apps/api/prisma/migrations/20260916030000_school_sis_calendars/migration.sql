-- School SIS holiday + academic calendar. Isolated school schema only.

CREATE TABLE "school"."school_academic_terms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "school_academic_terms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_academic_terms_academic_year_id_name_key" ON "school"."school_academic_terms"("academic_year_id", "name");
CREATE INDEX "school_academic_terms_tenant_id_academic_year_id_idx" ON "school"."school_academic_terms"("tenant_id", "academic_year_id");

CREATE TABLE "school"."school_holiday_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_holiday_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_holiday_types_tenant_id_code_key" ON "school"."school_holiday_types"("tenant_id", "code");

CREATE TABLE "school"."school_holidays" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "applies_to" TEXT NOT NULL DEFAULT 'ALL',
    "grade_ids" JSONB NOT NULL DEFAULT '[]',
    "section_ids" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurring_rule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_holidays_tenant_year_name_start_key" ON "school"."school_holidays"("tenant_id", "academic_year_id", "name", "start_date");
CREATE INDEX "school_holidays_tenant_year_dates_idx" ON "school"."school_holidays"("tenant_id", "academic_year_id", "start_date", "end_date");

CREATE TABLE "school"."school_weekly_off_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "weekdays" JSONB NOT NULL DEFAULT '[]',
    "saturday_rule" TEXT NOT NULL DEFAULT 'NONE',
    "custom_weeks" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_weekly_off_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_weekly_off_settings_tenant_year_key" ON "school"."school_weekly_off_settings"("tenant_id", "academic_year_id");

CREATE TABLE "school"."school_calendar_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SPECIAL_WORKING_DAY',
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_calendar_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_calendar_overrides_unique" ON "school"."school_calendar_overrides"("tenant_id", "academic_year_id", "date", "kind");
CREATE INDEX "school_calendar_overrides_year_date_idx" ON "school"."school_calendar_overrides"("tenant_id", "academic_year_id", "date");

CREATE TABLE "school"."school_calendar_event_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_calendar_event_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_calendar_event_categories_tenant_code_key" ON "school"."school_calendar_event_categories"("tenant_id", "code");

CREATE TABLE "school"."school_calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "audience" JSONB NOT NULL DEFAULT '[]',
    "grade_ids" JSONB NOT NULL DEFAULT '[]',
    "section_ids" JSONB NOT NULL DEFAULT '[]',
    "location" TEXT,
    "organizer_type" TEXT,
    "organizer_staff_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "important_parents" BOOLEAN NOT NULL DEFAULT false,
    "important_students" BOOLEAN NOT NULL DEFAULT false,
    "important_teachers" BOOLEAN NOT NULL DEFAULT false,
    "notify_parents" BOOLEAN NOT NULL DEFAULT false,
    "notify_students" BOOLEAN NOT NULL DEFAULT false,
    "notify_teachers" BOOLEAN NOT NULL DEFAULT false,
    "ptm" JSONB,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "holiday_id" UUID,
    "exam_id" UUID,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_calendar_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_calendar_events_holiday_id_key" ON "school"."school_calendar_events"("holiday_id");
CREATE UNIQUE INDEX "school_calendar_events_exam_id_key" ON "school"."school_calendar_events"("exam_id");
CREATE INDEX "school_calendar_events_year_dates_idx" ON "school"."school_calendar_events"("tenant_id", "academic_year_id", "start_date", "end_date");
CREATE INDEX "school_calendar_events_category_idx" ON "school"."school_calendar_events"("tenant_id", "category_id");

CREATE TABLE "school"."school_calendar_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "record_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_calendar_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "school_calendar_audit_logs_tenant_created_idx" ON "school"."school_calendar_audit_logs"("tenant_id", "created_at");

ALTER TABLE "school"."school_academic_terms" ADD CONSTRAINT "school_academic_terms_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_holidays" ADD CONSTRAINT "school_holidays_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_holidays" ADD CONSTRAINT "school_holidays_type_fkey" FOREIGN KEY ("type_id") REFERENCES "school"."school_holiday_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_weekly_off_settings" ADD CONSTRAINT "school_weekly_off_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_overrides" ADD CONSTRAINT "school_calendar_overrides_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_events" ADD CONSTRAINT "school_calendar_events_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_events" ADD CONSTRAINT "school_calendar_events_category_fkey" FOREIGN KEY ("category_id") REFERENCES "school"."school_calendar_event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_events" ADD CONSTRAINT "school_calendar_events_holiday_fkey" FOREIGN KEY ("holiday_id") REFERENCES "school"."school_holidays"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_events" ADD CONSTRAINT "school_calendar_events_exam_fkey" FOREIGN KEY ("exam_id") REFERENCES "school"."school_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_calendar_events" ADD CONSTRAINT "school_calendar_events_staff_fkey" FOREIGN KEY ("organizer_staff_id") REFERENCES "school"."school_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
