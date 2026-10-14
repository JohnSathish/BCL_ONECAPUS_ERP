CREATE TABLE IF NOT EXISTS "academic"."exam_duty_rosters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "instructions" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3),
  "published_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "exam_duty_rosters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_duty_rosters_session_id_key" ON "academic"."exam_duty_rosters"("session_id");
CREATE INDEX IF NOT EXISTS "exam_duty_rosters_tenant_id_status_idx" ON "academic"."exam_duty_rosters"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."exam_duty_sittings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "roster_id" UUID NOT NULL,
  "exam_date" DATE NOT NULL,
  "session_label" TEXT NOT NULL,
  "custom_label" TEXT,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "reporting_time" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_duty_sittings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_duty_sittings_tenant_id_roster_id_idx" ON "academic"."exam_duty_sittings"("tenant_id", "roster_id");
CREATE INDEX IF NOT EXISTS "exam_duty_sittings_exam_date_idx" ON "academic"."exam_duty_sittings"("exam_date");

CREATE TABLE IF NOT EXISTS "academic"."exam_duty_halls" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "sitting_id" UUID NOT NULL,
  "classroom_id" UUID,
  "hall_label" TEXT NOT NULL,
  "student_count" INTEGER NOT NULL DEFAULT 0,
  "capacity" INTEGER,
  "special_room" BOOLEAN NOT NULL DEFAULT false,
  "calculated_required" INTEGER NOT NULL DEFAULT 1,
  "approved_required" INTEGER NOT NULL DEFAULT 1,
  "override_reason" TEXT,
  "override_by_id" UUID,
  "override_at" TIMESTAMP(3),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_duty_halls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_duty_halls_tenant_id_sitting_id_idx" ON "academic"."exam_duty_halls"("tenant_id", "sitting_id");

CREATE TABLE IF NOT EXISTS "academic"."exam_duty_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "sitting_id" UUID NOT NULL,
  "hall_id" UUID NOT NULL,
  "staff_profile_id" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'INVIGILATOR',
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_duty_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_duty_assignments_sitting_id_staff_profile_id_key" ON "academic"."exam_duty_assignments"("sitting_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "exam_duty_assignments_tenant_id_hall_id_idx" ON "academic"."exam_duty_assignments"("tenant_id", "hall_id");
CREATE INDEX IF NOT EXISTS "exam_duty_assignments_staff_profile_id_idx" ON "academic"."exam_duty_assignments"("staff_profile_id");

CREATE TABLE IF NOT EXISTS "academic"."exam_duty_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "bands" JSONB NOT NULL DEFAULT '[]',
  "minimum" INTEGER NOT NULL DEFAULT 1,
  "special_hall_extra" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_duty_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "exam_duty_rules_tenant_id_key" ON "academic"."exam_duty_rules"("tenant_id");

CREATE TABLE IF NOT EXISTS "academic"."exam_duty_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "roster_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_duty_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exam_duty_audits_tenant_id_roster_id_idx" ON "academic"."exam_duty_audits"("tenant_id", "roster_id");

DO $$ BEGIN
  ALTER TABLE "academic"."exam_duty_sittings"
    ADD CONSTRAINT "exam_duty_sittings_roster_id_fkey"
    FOREIGN KEY ("roster_id") REFERENCES "academic"."exam_duty_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."exam_duty_halls"
    ADD CONSTRAINT "exam_duty_halls_sitting_id_fkey"
    FOREIGN KEY ("sitting_id") REFERENCES "academic"."exam_duty_sittings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."exam_duty_assignments"
    ADD CONSTRAINT "exam_duty_assignments_sitting_id_fkey"
    FOREIGN KEY ("sitting_id") REFERENCES "academic"."exam_duty_sittings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."exam_duty_assignments"
    ADD CONSTRAINT "exam_duty_assignments_hall_id_fkey"
    FOREIGN KEY ("hall_id") REFERENCES "academic"."exam_duty_halls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."exam_duty_audits"
    ADD CONSTRAINT "exam_duty_audits_roster_id_fkey"
    FOREIGN KEY ("roster_id") REFERENCES "academic"."exam_duty_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
