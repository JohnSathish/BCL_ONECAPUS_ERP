-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "academic";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "compliance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "core";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform";

-- CreateTable
CREATE TABLE "platform"."tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."tenant_domains" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenant_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."permissions" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "platform"."user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "campus_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."refresh_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "jti" TEXT NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."institutions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."campuses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campus_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."academic_years" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."semesters" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."programs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."program_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_from" DATE,
    "cbcs_enabled" BOOLEAN NOT NULL DEFAULT true,
    "nep_profile" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" DECIMAL(5,2) NOT NULL,
    "course_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."course_offerings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "semester_id" UUID,
    "is_elective" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."students" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_version_id" UUID,
    "enrollment_number" TEXT NOT NULL,
    "admission_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."faculty" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "department_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic"."registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."fee_structures" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."credit_ledger_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "credits" DECIMAL(6,2) NOT NULL,
    "entry_type" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."abc_accounts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "abc_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "abc_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."abc_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "abc_account_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "credits" DECIMAL(6,2) NOT NULL,
    "external_ref" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abc_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."program_outcomes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bloom_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "program_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."course_outcomes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bloom_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."co_po_maps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "course_outcome_id" UUID NOT NULL,
    "program_outcome_id" UUID NOT NULL,
    "weight" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "co_po_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance"."outcome_attainment_runs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_version_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "parameters" JSONB,
    "results" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_attainment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "platform"."tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_domains_host_key" ON "platform"."tenant_domains"("host");

-- CreateIndex
CREATE INDEX "tenant_domains_tenant_id_idx" ON "platform"."tenant_domains"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "platform"."users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "platform"."users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "user_identities_user_id_idx" ON "platform"."user_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_provider_user_id_key" ON "platform"."user_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "platform"."roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_slug_key" ON "platform"."roles"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_slug_key" ON "platform"."permissions"("slug");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "platform"."user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "platform"."user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_jti_key" ON "platform"."refresh_sessions"("jti");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_family_id_idx" ON "platform"."refresh_sessions"("user_id", "family_id");

-- CreateIndex
CREATE INDEX "refresh_sessions_tenant_id_idx" ON "platform"."refresh_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "platform"."audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "institutions_tenant_id_idx" ON "core"."institutions"("tenant_id");

-- CreateIndex
CREATE INDEX "campuses_tenant_id_idx" ON "core"."campuses"("tenant_id");

-- CreateIndex
CREATE INDEX "campuses_institution_id_idx" ON "core"."campuses"("institution_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "core"."departments"("tenant_id");

-- CreateIndex
CREATE INDEX "academic_years_tenant_id_idx" ON "core"."academic_years"("tenant_id");

-- CreateIndex
CREATE INDEX "semesters_tenant_id_idx" ON "core"."semesters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_academic_year_id_sequence_key" ON "core"."semesters"("academic_year_id", "sequence");

-- CreateIndex
CREATE INDEX "programs_tenant_id_idx" ON "academic"."programs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_tenant_id_code_key" ON "academic"."programs"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "program_versions_tenant_id_idx" ON "academic"."program_versions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_versions_program_id_version_key" ON "academic"."program_versions"("program_id", "version");

-- CreateIndex
CREATE INDEX "courses_tenant_id_idx" ON "academic"."courses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_tenant_id_code_key" ON "academic"."courses"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "course_offerings_tenant_id_idx" ON "academic"."course_offerings"("tenant_id");

-- CreateIndex
CREATE INDEX "course_offerings_program_version_id_idx" ON "academic"."course_offerings"("program_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "academic"."students"("user_id");

-- CreateIndex
CREATE INDEX "students_tenant_id_idx" ON "academic"."students"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_tenant_id_enrollment_number_key" ON "academic"."students"("tenant_id", "enrollment_number");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_user_id_key" ON "academic"."faculty"("user_id");

-- CreateIndex
CREATE INDEX "faculty_tenant_id_idx" ON "academic"."faculty"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_tenant_id_employee_code_key" ON "academic"."faculty"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "registrations_tenant_id_idx" ON "academic"."registrations"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_student_id_offering_id_key" ON "academic"."registrations"("student_id", "offering_id");

-- CreateIndex
CREATE INDEX "fee_structures_tenant_id_idx" ON "finance"."fee_structures"("tenant_id");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_tenant_id_student_id_created_at_idx" ON "compliance"."credit_ledger_entries"("tenant_id", "student_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "abc_accounts_student_id_key" ON "compliance"."abc_accounts"("student_id");

-- CreateIndex
CREATE INDEX "abc_accounts_tenant_id_idx" ON "compliance"."abc_accounts"("tenant_id");

-- CreateIndex
CREATE INDEX "abc_transactions_tenant_id_abc_account_id_idx" ON "compliance"."abc_transactions"("tenant_id", "abc_account_id");

-- CreateIndex
CREATE INDEX "program_outcomes_tenant_id_idx" ON "compliance"."program_outcomes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_outcomes_program_version_id_code_key" ON "compliance"."program_outcomes"("program_version_id", "code");

-- CreateIndex
CREATE INDEX "course_outcomes_tenant_id_idx" ON "compliance"."course_outcomes"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_outcomes_course_id_code_key" ON "compliance"."course_outcomes"("course_id", "code");

-- CreateIndex
CREATE INDEX "co_po_maps_tenant_id_idx" ON "compliance"."co_po_maps"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "co_po_maps_course_outcome_id_program_outcome_id_key" ON "compliance"."co_po_maps"("course_outcome_id", "program_outcome_id");

-- CreateIndex
CREATE INDEX "outcome_attainment_runs_tenant_id_program_version_id_idx" ON "compliance"."outcome_attainment_runs"("tenant_id", "program_version_id");

-- AddForeignKey
ALTER TABLE "platform"."tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."institutions" ADD CONSTRAINT "institutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."campuses" ADD CONSTRAINT "campuses_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."departments" ADD CONSTRAINT "departments_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."semesters" ADD CONSTRAINT "semesters_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "core"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."program_versions" ADD CONSTRAINT "program_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."course_offerings" ADD CONSTRAINT "course_offerings_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."course_offerings" ADD CONSTRAINT "course_offerings_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."course_offerings" ADD CONSTRAINT "course_offerings_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "core"."semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."students" ADD CONSTRAINT "students_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."faculty" ADD CONSTRAINT "faculty_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."registrations" ADD CONSTRAINT "registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic"."registrations" ADD CONSTRAINT "registrations_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "academic"."course_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."abc_accounts" ADD CONSTRAINT "abc_accounts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."abc_transactions" ADD CONSTRAINT "abc_transactions_abc_account_id_fkey" FOREIGN KEY ("abc_account_id") REFERENCES "compliance"."abc_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."program_outcomes" ADD CONSTRAINT "program_outcomes_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."course_outcomes" ADD CONSTRAINT "course_outcomes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."co_po_maps" ADD CONSTRAINT "co_po_maps_course_outcome_id_fkey" FOREIGN KEY ("course_outcome_id") REFERENCES "compliance"."course_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance"."co_po_maps" ADD CONSTRAINT "co_po_maps_program_outcome_id_fkey" FOREIGN KEY ("program_outcome_id") REFERENCES "compliance"."program_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

