-- Advanced registration: shifts, sections, section-level seat ledgers

CREATE TABLE "academic"."academic_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "academic_shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_shifts_tenant_id_code_key" ON "academic"."academic_shifts"("tenant_id", "code");
CREATE INDEX "academic_shifts_tenant_id_idx" ON "academic"."academic_shifts"("tenant_id");

CREATE TABLE "academic"."classrooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "classrooms_tenant_id_code_key" ON "academic"."classrooms"("tenant_id", "code");
CREATE INDEX "classrooms_tenant_id_idx" ON "academic"."classrooms"("tenant_id");

ALTER TABLE "academic"."student_academic_profiles"
ADD COLUMN IF NOT EXISTS "preferred_shift_id" UUID;

ALTER TABLE "academic"."registration_windows"
ADD COLUMN IF NOT EXISTS "add_drop_opens_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "add_drop_closes_at" TIMESTAMP(3);

CREATE TABLE "academic"."offering_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "course_offering_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "section_code" TEXT NOT NULL DEFAULT 'A',
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "waitlist_capacity" INTEGER NOT NULL DEFAULT 10,
    "faculty_id" UUID,
    "classroom_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reservation_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "offering_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offering_sections_course_offering_id_shift_id_section_code_key"
ON "academic"."offering_sections"("course_offering_id", "shift_id", "section_code");
CREATE INDEX "offering_sections_tenant_id_idx" ON "academic"."offering_sections"("tenant_id");
CREATE INDEX "offering_sections_course_offering_id_idx" ON "academic"."offering_sections"("course_offering_id");

ALTER TABLE "academic"."offering_sections"
ADD CONSTRAINT "offering_sections_course_offering_id_fkey"
FOREIGN KEY ("course_offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."offering_sections"
ADD CONSTRAINT "offering_sections_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "academic"."academic_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic"."offering_sections"
ADD CONSTRAINT "offering_sections_faculty_id_fkey"
FOREIGN KEY ("faculty_id") REFERENCES "academic"."faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."offering_sections"
ADD CONSTRAINT "offering_sections_classroom_id_fkey"
FOREIGN KEY ("classroom_id") REFERENCES "academic"."classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate seat ledgers from offering to section level
CREATE TABLE "academic"."offering_seat_ledgers_new" (
    "offering_section_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "waitlist_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "offering_seat_ledgers_new_pkey" PRIMARY KEY ("offering_section_id")
);

ALTER TABLE "academic"."semester_registration_lines"
ADD COLUMN IF NOT EXISTS "offering_section_id" UUID;

CREATE TABLE "academic"."registration_approval_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID,
    "registration_window_id" UUID,
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "approver_roles" JSONB NOT NULL DEFAULT '[]',
    "auto_on_window_close" BOOLEAN NOT NULL DEFAULT false,
    "credit_policy" JSONB,
    "shift_policy" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_approval_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_approval_policies_tenant_id_idx" ON "academic"."registration_approval_policies"("tenant_id");
CREATE INDEX "registration_approval_policies_tenant_id_program_version_id_idx"
ON "academic"."registration_approval_policies"("tenant_id", "program_version_id");

ALTER TABLE "academic"."registration_approval_policies"
ADD CONSTRAINT "registration_approval_policies_registration_window_id_fkey"
FOREIGN KEY ("registration_window_id") REFERENCES "academic"."registration_windows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."registration_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "acted_by_id" UUID,
    "comment" TEXT,
    "acted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registration_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_approvals_tenant_id_registration_id_idx"
ON "academic"."registration_approvals"("tenant_id", "registration_id");

ALTER TABLE "academic"."registration_approvals"
ADD CONSTRAINT "registration_approvals_registration_id_fkey"
FOREIGN KEY ("registration_id") REFERENCES "academic"."semester_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "academic"."registration_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registration_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_audit_logs_tenant_id_registration_id_idx"
ON "academic"."registration_audit_logs"("tenant_id", "registration_id");

ALTER TABLE "academic"."registration_audit_logs"
ADD CONSTRAINT "registration_audit_logs_registration_id_fkey"
FOREIGN KEY ("registration_id") REFERENCES "academic"."semester_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."waitlist_promotions"
ADD COLUMN IF NOT EXISTS "offering_section_id" UUID;

ALTER TABLE "academic"."student_academic_profiles"
ADD CONSTRAINT "student_academic_profiles_preferred_shift_id_fkey"
FOREIGN KEY ("preferred_shift_id") REFERENCES "academic"."academic_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."semester_registration_lines"
ADD CONSTRAINT "semester_registration_lines_offering_section_id_fkey"
FOREIGN KEY ("offering_section_id") REFERENCES "academic"."offering_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default DAY shift per tenant (seed will refine)
INSERT INTO "academic"."academic_shifts" ("id", "tenant_id", "code", "name", "sort_order", "updated_at")
SELECT gen_random_uuid(), t.id, 'DAY', 'Day Shift', 1, CURRENT_TIMESTAMP
FROM "platform"."tenants" t
WHERE t.deleted_at IS NULL;

-- Create one section per offering on DAY shift and migrate seat counts
INSERT INTO "academic"."offering_sections" (
  "id", "tenant_id", "course_offering_id", "shift_id", "section_code",
  "capacity", "waitlist_capacity", "updated_at"
)
SELECT
  gen_random_uuid(),
  co.tenant_id,
  co.id,
  sh.id,
  'A',
  co.capacity,
  co.waitlist_capacity,
  CURRENT_TIMESTAMP
FROM "academic"."course_offerings" co
JOIN "academic"."academic_shifts" sh ON sh.tenant_id = co.tenant_id AND sh.code = 'DAY'
WHERE co.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM "academic"."offering_sections" os
  WHERE os.course_offering_id = co.id AND os.shift_id = sh.id AND os.section_code = 'A'
);

INSERT INTO "academic"."offering_seat_ledgers_new" (
  "offering_section_id", "tenant_id", "confirmed_count", "waitlist_count", "updated_at"
)
SELECT
  os.id,
  os.tenant_id,
  COALESCE(old.confirmed_count, 0),
  COALESCE(old.waitlist_count, 0),
  CURRENT_TIMESTAMP
FROM "academic"."offering_sections" os
LEFT JOIN "academic"."offering_seat_ledgers" old ON old.offering_id = os.course_offering_id
WHERE os.section_code = 'A'
ON CONFLICT ("offering_section_id") DO NOTHING;

UPDATE "academic"."semester_registration_lines" l
SET "offering_section_id" = os.id
FROM "academic"."offering_sections" os
WHERE os.course_offering_id = l.offering_id
  AND os.section_code = 'A'
  AND l.offering_section_id IS NULL;

DROP TABLE IF EXISTS "academic"."offering_seat_ledgers";
ALTER TABLE "academic"."offering_seat_ledgers_new" RENAME TO "offering_seat_ledgers";
CREATE INDEX "offering_seat_ledgers_tenant_id_idx" ON "academic"."offering_seat_ledgers"("tenant_id");

ALTER TABLE "academic"."offering_seat_ledgers"
ADD CONSTRAINT "offering_seat_ledgers_offering_section_id_fkey"
FOREIGN KEY ("offering_section_id") REFERENCES "academic"."offering_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "academic"."semester_registration_lines_registration_id_offering_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "semester_registration_lines_registration_id_offering_section_id_key"
ON "academic"."semester_registration_lines"("registration_id", "offering_section_id");
