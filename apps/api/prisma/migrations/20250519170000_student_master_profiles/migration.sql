-- Student master profiles, documents, and lookup masters

CREATE TABLE IF NOT EXISTS "core"."master_lookups" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "lookup_type" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "master_lookups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_lookups_tenant_id_lookup_type_code_key"
  ON "core"."master_lookups"("tenant_id", "lookup_type", "code");

CREATE INDEX IF NOT EXISTS "master_lookups_tenant_id_lookup_type_is_active_idx"
  ON "core"."master_lookups"("tenant_id", "lookup_type", "is_active");

ALTER TABLE "academic"."students"
  ADD COLUMN IF NOT EXISTS "roll_number" TEXT,
  ADD COLUMN IF NOT EXISTS "admission_application_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "students_tenant_id_roll_number_key"
  ON "academic"."students"("tenant_id", "roll_number")
  WHERE "roll_number" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "students_admission_application_id_key"
  ON "academic"."students"("admission_application_id")
  WHERE "admission_application_id" IS NOT NULL;

ALTER TABLE "academic"."students"
  ADD CONSTRAINT "students_admission_application_id_fkey"
  FOREIGN KEY ("admission_application_id") REFERENCES "academic"."admission_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_profiles" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "gender" TEXT,
  "date_of_birth" DATE,
  "mobile_number" TEXT,
  "national_id" TEXT,
  "nationality_lookup_id" UUID,
  "blood_group_lookup_id" UUID,
  "religion_lookup_id" UUID,
  "category_lookup_id" UUID,
  "address" JSONB,
  "guardian_name" TEXT,
  "guardian_mobile" TEXT,
  "photo_path" TEXT,
  "admission_status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_profiles_student_id_key"
  ON "academic"."student_profiles"("student_id");

CREATE INDEX IF NOT EXISTS "student_profiles_tenant_id_idx"
  ON "academic"."student_profiles"("tenant_id");

CREATE INDEX IF NOT EXISTS "student_profiles_full_name_idx"
  ON "academic"."student_profiles"("full_name");

CREATE INDEX IF NOT EXISTS "student_profiles_mobile_number_idx"
  ON "academic"."student_profiles"("mobile_number");

ALTER TABLE "academic"."student_profiles"
  ADD CONSTRAINT "student_profiles_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "academic"."student_documents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "document_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "uploaded_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_documents_tenant_id_student_id_idx"
  ON "academic"."student_documents"("tenant_id", "student_id");

ALTER TABLE "academic"."student_documents"
  ADD CONSTRAINT "student_documents_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."student_documents"
  ADD CONSTRAINT "student_documents_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "platform"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
