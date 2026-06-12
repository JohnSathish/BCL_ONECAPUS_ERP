-- Front Office Phase 1 — enquiries, gate passes, complaints

CREATE TABLE IF NOT EXISTS "core"."front_office_enquiries" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "enquiry_no" TEXT NOT NULL,
  "enquiry_type" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "mobile" TEXT,
  "email" TEXT,
  "programme_interest" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" UUID,
  "created_by_id" UUID,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "front_office_enquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "front_office_enquiries_tenant_id_enquiry_no_key"
  ON "core"."front_office_enquiries"("tenant_id", "enquiry_no");
CREATE INDEX IF NOT EXISTS "front_office_enquiries_tenant_id_status_idx"
  ON "core"."front_office_enquiries"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "front_office_enquiries_tenant_id_created_at_idx"
  ON "core"."front_office_enquiries"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "core"."front_office_gate_passes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "pass_number" TEXT NOT NULL,
  "visitor_name" TEXT NOT NULL,
  "mobile" TEXT,
  "id_proof_type" TEXT,
  "id_proof_number" TEXT,
  "host_name" TEXT,
  "host_department" TEXT,
  "host_mobile" TEXT,
  "purpose" TEXT,
  "vehicle_no" TEXT,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_until" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "check_in_at" TIMESTAMP(3),
  "check_out_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "front_office_gate_passes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "front_office_gate_passes_tenant_id_pass_number_key"
  ON "core"."front_office_gate_passes"("tenant_id", "pass_number");
CREATE INDEX IF NOT EXISTS "front_office_gate_passes_tenant_id_status_idx"
  ON "core"."front_office_gate_passes"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "front_office_gate_passes_tenant_id_valid_until_idx"
  ON "core"."front_office_gate_passes"("tenant_id", "valid_until");

CREATE TABLE IF NOT EXISTS "core"."front_office_complaints" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "ticket_no" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "complainant_name" TEXT NOT NULL,
  "complainant_mobile" TEXT,
  "complainant_email" TEXT,
  "student_id" UUID,
  "staff_profile_id" UUID,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" UUID,
  "resolution" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "front_office_complaints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "front_office_complaints_tenant_id_ticket_no_key"
  ON "core"."front_office_complaints"("tenant_id", "ticket_no");
CREATE INDEX IF NOT EXISTS "front_office_complaints_tenant_id_status_idx"
  ON "core"."front_office_complaints"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "front_office_complaints_tenant_id_category_idx"
  ON "core"."front_office_complaints"("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "front_office_complaints_tenant_id_created_at_idx"
  ON "core"."front_office_complaints"("tenant_id", "created_at");
