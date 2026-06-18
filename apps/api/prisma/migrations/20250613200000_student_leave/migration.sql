-- Student leave applications for Principal Desk leave approval center

CREATE TABLE IF NOT EXISTS "academic"."student_leave_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "yearly_limit" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_leave_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "student_leave_types_tenant_id_code_key"
  ON "academic"."student_leave_types"("tenant_id", "code");

CREATE TABLE IF NOT EXISTS "academic"."student_leave_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "from_date" DATE NOT NULL,
  "to_date" DATE NOT NULL,
  "total_days" DECIMAL(6,2) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attachment_url" TEXT,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_leave_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "student_leave_applications_tenant_id_student_id_idx"
  ON "academic"."student_leave_applications"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "student_leave_applications_tenant_id_status_idx"
  ON "academic"."student_leave_applications"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "student_leave_applications_tenant_id_from_date_idx"
  ON "academic"."student_leave_applications"("tenant_id", "from_date");

DO $$ BEGIN
  ALTER TABLE "academic"."student_leave_applications"
    ADD CONSTRAINT "student_leave_applications_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."student_leave_applications"
    ADD CONSTRAINT "student_leave_applications_leave_type_id_fkey"
    FOREIGN KEY ("leave_type_id") REFERENCES "academic"."student_leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
