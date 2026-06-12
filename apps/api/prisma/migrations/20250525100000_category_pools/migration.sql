-- Category pools for shared FYUGP curriculum mappings

ALTER TABLE "academic"."course_offerings"
  ADD COLUMN "category_pool_id" UUID,
  ADD COLUMN "mapping_source" TEXT NOT NULL DEFAULT 'DIRECT';

ALTER TABLE "academic"."course_offerings"
  ALTER COLUMN "program_version_id" DROP NOT NULL;

CREATE TABLE "academic"."category_pools" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "pool_name" TEXT NOT NULL,
  "semester_no" INTEGER NOT NULL,
  "category_type" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "category_pools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."category_pool_courses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "pool_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "category_pool_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."programme_pool_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "program_version_id" UUID NOT NULL,
  "semester_no" INTEGER NOT NULL,
  "pool_id" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "programme_pool_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."programme_pool_course_exclusions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "program_version_id" UUID NOT NULL,
  "pool_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "programme_pool_course_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "category_pools_tenant_id_institution_id_pool_name_key"
  ON "academic"."category_pools"("tenant_id", "institution_id", "pool_name");
CREATE INDEX "category_pools_tenant_id_active_idx"
  ON "academic"."category_pools"("tenant_id", "active");
CREATE INDEX "category_pools_tenant_id_category_type_semester_no_idx"
  ON "academic"."category_pools"("tenant_id", "category_type", "semester_no");
CREATE INDEX "category_pools_institution_id_idx"
  ON "academic"."category_pools"("institution_id");

CREATE UNIQUE INDEX "category_pool_courses_pool_id_course_id_key"
  ON "academic"."category_pool_courses"("pool_id", "course_id");
CREATE INDEX "category_pool_courses_pool_id_active_idx"
  ON "academic"."category_pool_courses"("pool_id", "active");

CREATE UNIQUE INDEX "programme_pool_assignments_program_version_id_semester_no_pool_id_key"
  ON "academic"."programme_pool_assignments"("program_version_id", "semester_no", "pool_id");
CREATE INDEX "programme_pool_assignments_tenant_id_idx"
  ON "academic"."programme_pool_assignments"("tenant_id");
CREATE INDEX "programme_pool_assignments_pool_id_idx"
  ON "academic"."programme_pool_assignments"("pool_id");

CREATE UNIQUE INDEX "programme_pool_course_exclusions_program_version_id_pool_id_course_id_key"
  ON "academic"."programme_pool_course_exclusions"("program_version_id", "pool_id", "course_id");
CREATE INDEX "programme_pool_course_exclusions_tenant_id_idx"
  ON "academic"."programme_pool_course_exclusions"("tenant_id");
CREATE INDEX "programme_pool_course_exclusions_pool_id_idx"
  ON "academic"."programme_pool_course_exclusions"("pool_id");

CREATE UNIQUE INDEX "course_offerings_category_pool_id_course_id_key"
  ON "academic"."course_offerings"("category_pool_id", "course_id");
CREATE INDEX "course_offerings_category_pool_id_idx"
  ON "academic"."course_offerings"("category_pool_id");
CREATE INDEX "course_offerings_mapping_source_idx"
  ON "academic"."course_offerings"("mapping_source");

ALTER TABLE "academic"."category_pools"
  ADD CONSTRAINT "category_pools_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."category_pools"
  ADD CONSTRAINT "category_pools_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."category_pool_courses"
  ADD CONSTRAINT "category_pool_courses_pool_id_fkey"
  FOREIGN KEY ("pool_id") REFERENCES "academic"."category_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."category_pool_courses"
  ADD CONSTRAINT "category_pool_courses_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."programme_pool_assignments"
  ADD CONSTRAINT "programme_pool_assignments_program_version_id_fkey"
  FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."programme_pool_assignments"
  ADD CONSTRAINT "programme_pool_assignments_pool_id_fkey"
  FOREIGN KEY ("pool_id") REFERENCES "academic"."category_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."programme_pool_course_exclusions"
  ADD CONSTRAINT "programme_pool_course_exclusions_program_version_id_fkey"
  FOREIGN KEY ("program_version_id") REFERENCES "academic"."program_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."programme_pool_course_exclusions"
  ADD CONSTRAINT "programme_pool_course_exclusions_pool_id_fkey"
  FOREIGN KEY ("pool_id") REFERENCES "academic"."category_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."programme_pool_course_exclusions"
  ADD CONSTRAINT "programme_pool_course_exclusions_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."course_offerings"
  ADD CONSTRAINT "course_offerings_category_pool_id_fkey"
  FOREIGN KEY ("category_pool_id") REFERENCES "academic"."category_pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
