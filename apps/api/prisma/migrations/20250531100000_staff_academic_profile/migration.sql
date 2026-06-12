-- Staff academic profile enhancement

-- Academic role definitions catalog
CREATE TABLE "core"."academic_role_definitions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_role_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_role_definitions_tenant_id_code_key" ON "core"."academic_role_definitions"("tenant_id", "code");
CREATE INDEX "academic_role_definitions_tenant_id_idx" ON "core"."academic_role_definitions"("tenant_id");

-- Extend staff_profiles
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "campus_id" UUID;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "short_code" TEXT;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "probation_end_date" DATE;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "confirmation_date" DATE;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "relieving_date" DATE;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "retirement_date" DATE;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "last_working_date" DATE;
ALTER TABLE "academic"."staff_profiles" ADD COLUMN "resignation_reason" TEXT;

CREATE INDEX "staff_profiles_campus_id_idx" ON "academic"."staff_profiles"("campus_id");
CREATE INDEX "staff_profiles_short_code_idx" ON "academic"."staff_profiles"("short_code");
CREATE UNIQUE INDEX "staff_profiles_campus_id_short_code_key" ON "academic"."staff_profiles"("campus_id", "short_code");

ALTER TABLE "academic"."staff_profiles" ADD CONSTRAINT "staff_profiles_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Staff additional roles
CREATE TABLE "academic"."staff_additional_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "role_code" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_additional_roles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_additional_roles_tenant_id_idx" ON "academic"."staff_additional_roles"("tenant_id");
CREATE INDEX "staff_additional_roles_staff_profile_id_active_idx" ON "academic"."staff_additional_roles"("staff_profile_id", "active");
CREATE INDEX "staff_additional_roles_role_code_idx" ON "academic"."staff_additional_roles"("role_code");

ALTER TABLE "academic"."staff_additional_roles" ADD CONSTRAINT "staff_additional_roles_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Staff publications
CREATE TABLE "academic"."staff_publications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "publication_type" TEXT NOT NULL,
    "journal" TEXT,
    "isbn_issn" TEXT,
    "doi" TEXT,
    "co_authors" TEXT,
    "indexed_in" TEXT,
    "published_at" DATE,
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_publications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_publications_tenant_id_staff_profile_id_idx" ON "academic"."staff_publications"("tenant_id", "staff_profile_id");

ALTER TABLE "academic"."staff_publications" ADD CONSTRAINT "staff_publications_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Staff awards
CREATE TABLE "academic"."staff_awards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "level" TEXT,
    "award_date" DATE,
    "description" TEXT,
    "certificate_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_awards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_awards_tenant_id_staff_profile_id_idx" ON "academic"."staff_awards"("tenant_id", "staff_profile_id");

ALTER TABLE "academic"."staff_awards" ADD CONSTRAINT "staff_awards_staff_profile_id_fkey" FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend staff shift assignments
ALTER TABLE "academic"."staff_shift_assignments" ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "academic"."staff_shift_assignments" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "academic"."staff_shift_assignments" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "staff_shift_assignments_staff_profile_id_active_idx" ON "academic"."staff_shift_assignments"("staff_profile_id", "active");

-- Deactivate HOD designation in catalog
UPDATE "core"."designations" SET "is_active" = false WHERE "code" = 'HOD';

-- Migrate staff with HOD designation to additional role
INSERT INTO "academic"."staff_additional_roles" ("id", "tenant_id", "staff_profile_id", "role_code", "role_name", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), sp."tenant_id", sp."id", 'HOD', 'Head of Department', true, NOW(), NOW()
FROM "academic"."staff_profiles" sp
JOIN "core"."designations" d ON d."id" = sp."designation_id"
WHERE d."code" = 'HOD' AND sp."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."staff_additional_roles" sar
    WHERE sar."staff_profile_id" = sp."id" AND sar."role_code" = 'HOD'
  );

UPDATE "academic"."staff_profiles" sp
SET "designation_id" = NULL
FROM "core"."designations" d
WHERE d."id" = sp."designation_id" AND d."code" = 'HOD';

-- Backfill campus_id from department or primary shift
UPDATE "academic"."staff_profiles" sp
SET "campus_id" = dept."campus_id"
FROM "core"."departments" dept
WHERE sp."department_id" = dept."id" AND sp."campus_id" IS NULL AND dept."campus_id" IS NOT NULL;

UPDATE "academic"."staff_profiles" sp
SET "campus_id" = sh."campus_id"
FROM "core"."shifts" sh
WHERE sp."primary_shift_id" = sh."id" AND sp."campus_id" IS NULL;

-- Backfill primary shift assignments
INSERT INTO "academic"."staff_shift_assignments" ("id", "tenant_id", "staff_profile_id", "shift_id", "is_primary", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), sp."tenant_id", sp."id", sp."primary_shift_id", true, true, NOW(), NOW()
FROM "academic"."staff_profiles" sp
WHERE sp."primary_shift_id" IS NOT NULL AND sp."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."staff_shift_assignments" ssa
    WHERE ssa."staff_profile_id" = sp."id" AND ssa."shift_id" = sp."primary_shift_id"
  );

UPDATE "academic"."staff_shift_assignments" ssa
SET "is_primary" = true, "active" = true
FROM "academic"."staff_profiles" sp
WHERE ssa."staff_profile_id" = sp."id" AND ssa."shift_id" = sp."primary_shift_id";
