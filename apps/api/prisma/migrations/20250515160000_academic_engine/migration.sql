-- Academic Engine Phase 1

CREATE TABLE "core"."academic_streams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_streams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_streams_tenant_id_code_key" ON "core"."academic_streams"("tenant_id", "code");
CREATE INDEX "academic_streams_tenant_id_idx" ON "core"."academic_streams"("tenant_id");

ALTER TABLE "academic"."courses" ADD COLUMN "department_id" UUID;
ALTER TABLE "academic"."courses" ADD COLUMN "primary_category" TEXT;
ALTER TABLE "academic"."courses" ADD COLUMN "subject_slug" TEXT;
ALTER TABLE "academic"."courses" ADD COLUMN "is_mandatory_vac" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "courses_subject_slug_idx" ON "academic"."courses"("subject_slug");

ALTER TABLE "academic"."course_offerings" ADD COLUMN "category" TEXT;
ALTER TABLE "academic"."course_offerings" ADD COLUMN "semester_sequence" INTEGER;
ALTER TABLE "academic"."course_offerings" ADD COLUMN "major_paper_index" INTEGER;
ALTER TABLE "academic"."course_offerings" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 40;
ALTER TABLE "academic"."course_offerings" ADD COLUMN "waitlist_capacity" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "academic"."course_offerings" ADD COLUMN "registration_opens_at" TIMESTAMP(3);
ALTER TABLE "academic"."course_offerings" ADD COLUMN "registration_closes_at" TIMESTAMP(3);
ALTER TABLE "academic"."course_offerings" ADD COLUMN "prerequisite_offering_ids" JSONB;

CREATE INDEX "course_offerings_semester_sequence_category_idx" ON "academic"."course_offerings"("semester_sequence", "category");

CREATE TABLE "academic"."program_structure_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID NOT NULL,
    "stream_id" UUID,
    "structure_type" TEXT NOT NULL DEFAULT 'FYUGP_4Y_8S',
    "total_semesters" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_structure_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_structure_templates_program_version_id_key" ON "academic"."program_structure_templates"("program_version_id");
CREATE INDEX "program_structure_templates_tenant_id_idx" ON "academic"."program_structure_templates"("tenant_id");

CREATE TABLE "academic"."semester_structure_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID NOT NULL,
    "semester_sequence" INTEGER NOT NULL,
    "category_counts" JSONB NOT NULL,
    "continuity_rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_structure_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "semester_structure_rules_program_version_id_semester_sequence_key" ON "academic"."semester_structure_rules"("program_version_id", "semester_sequence");
CREATE INDEX "semester_structure_rules_tenant_id_idx" ON "academic"."semester_structure_rules"("tenant_id");

CREATE TABLE "academic"."student_academic_profiles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "stream_id" UUID,
    "admission_year_id" UUID,
    "class12_subjects" JSONB NOT NULL DEFAULT '[]',
    "language_preferences" JSONB,
    "language_eligibility" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_academic_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_academic_profiles_student_id_key" ON "academic"."student_academic_profiles"("student_id");
CREATE INDEX "student_academic_profiles_tenant_id_idx" ON "academic"."student_academic_profiles"("tenant_id");

CREATE TABLE "academic"."student_program_choices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "choice_type" TEXT NOT NULL,
    "subject_slug" TEXT NOT NULL,
    "department_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effective_from_semester" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_program_choices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_program_choices_tenant_id_student_id_choice_type_sta_idx" ON "academic"."student_program_choices"("tenant_id", "student_id", "choice_type", "status");

CREATE TABLE "academic"."registration_windows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_windows_tenant_id_idx" ON "academic"."registration_windows"("tenant_id");

CREATE TABLE "academic"."semester_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "semester_sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "semester_registrations_student_id_semester_id_key" ON "academic"."semester_registrations"("student_id", "semester_id");
CREATE INDEX "semester_registrations_tenant_id_idx" ON "academic"."semester_registrations"("tenant_id");

CREATE TABLE "academic"."semester_registration_lines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority_rank" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_registration_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "semester_registration_lines_registration_id_offering_id_key" ON "academic"."semester_registration_lines"("registration_id", "offering_id");
CREATE INDEX "semester_registration_lines_tenant_id_registration_id_idx" ON "academic"."semester_registration_lines"("tenant_id", "registration_id");

CREATE TABLE "academic"."offering_seat_ledgers" (
    "offering_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "waitlist_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offering_seat_ledgers_pkey" PRIMARY KEY ("offering_id")
);

CREATE INDEX "offering_seat_ledgers_tenant_id_idx" ON "academic"."offering_seat_ledgers"("tenant_id");

CREATE TABLE "academic"."waitlist_promotions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "promoted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promoted_by_id" UUID,

    CONSTRAINT "waitlist_promotions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waitlist_promotions_tenant_id_offering_id_idx" ON "academic"."waitlist_promotions"("tenant_id", "offering_id");

CREATE TABLE "academic"."eligibility_rule_sets" (
    "tenant_id" UUID NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eligibility_rule_sets_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "academic"."registration_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_overrides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_overrides_tenant_id_idx" ON "academic"."registration_overrides"("tenant_id");

CREATE TABLE "academic"."student_semester_progress" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "semester_sequence" INTEGER NOT NULL,
    "credits_earned" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "credits_required" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_semester_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_semester_progress_student_id_semester_sequence_key" ON "academic"."student_semester_progress"("student_id", "semester_sequence");
CREATE INDEX "student_semester_progress_tenant_id_idx" ON "academic"."student_semester_progress"("tenant_id");

ALTER TABLE "academic"."courses" ADD CONSTRAINT "courses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."program_structure_templates" ADD CONSTRAINT "program_structure_templates_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."program_structure_templates" ADD CONSTRAINT "program_structure_templates_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "core"."academic_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."semester_structure_rules" ADD CONSTRAINT "semester_structure_rules_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_academic_profiles" ADD CONSTRAINT "student_academic_profiles_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "core"."academic_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "academic"."student_program_choices" ADD CONSTRAINT "student_program_choices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."registration_windows" ADD CONSTRAINT "registration_windows_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "core"."semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."semester_registrations" ADD CONSTRAINT "semester_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."semester_registrations" ADD CONSTRAINT "semester_registrations_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "core"."semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."semester_registration_lines" ADD CONSTRAINT "semester_registration_lines_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "academic"."semester_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."semester_registration_lines" ADD CONSTRAINT "semester_registration_lines_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."offering_seat_ledgers" ADD CONSTRAINT "offering_seat_ledgers_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."student_semester_progress" ADD CONSTRAINT "student_semester_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
