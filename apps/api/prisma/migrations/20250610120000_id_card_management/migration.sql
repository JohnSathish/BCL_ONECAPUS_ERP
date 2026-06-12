-- Identity & ID Card Management (targeted — no unrelated schema drift)

-- Staff blood group (mirrors student profile pattern)
ALTER TABLE "academic"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "blood_group_lookup_id" UUID;

-- ID card settings (one row per tenant)
CREATE TABLE IF NOT EXISTS "academic"."id_card_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_width_mm" DECIMAL(6,2) NOT NULL DEFAULT 53.98,
    "card_height_mm" DECIMAL(6,2) NOT NULL DEFAULT 85.6,
    "qr_prefix" TEXT NOT NULL DEFAULT 'DBC',
    "qr_format" TEXT NOT NULL DEFAULT '{PREFIX}-{TYPE}-{YEAR}-{SEQ}',
    "barcode_format" TEXT NOT NULL DEFAULT 'CODE128',
    "validity_years" INTEGER NOT NULL DEFAULT 2,
    "show_blood_group" BOOLEAN NOT NULL DEFAULT true,
    "show_rfid_on_card" BOOLEAN NOT NULL DEFAULT false,
    "institution_signature_url" TEXT,
    "watermark_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_card_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "id_card_settings_tenant_id_key"
  ON "academic"."id_card_settings"("tenant_id");

-- Card templates
CREATE TABLE IF NOT EXISTS "academic"."id_card_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holder_type" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_card_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "id_card_templates_tenant_id_code_key"
  ON "academic"."id_card_templates"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "id_card_templates_tenant_id_holder_type_idx"
  ON "academic"."id_card_templates"("tenant_id", "holder_type");

-- Card issues
CREATE TABLE IF NOT EXISTS "academic"."id_card_issues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_number" TEXT NOT NULL,
    "holder_type" TEXT NOT NULL,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "template_id" UUID,
    "qr_payload" TEXT NOT NULL,
    "rfid_uid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "issue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printed_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "replaced_by_id" UUID,
    "reissue_reason" TEXT,
    "reissue_fee" DECIMAL(10,2),
    "previous_issue_id" UUID,
    "lost_reported_at" TIMESTAMP(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_card_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "id_card_issues_tenant_id_card_number_key"
  ON "academic"."id_card_issues"("tenant_id", "card_number");
CREATE INDEX IF NOT EXISTS "id_card_issues_tenant_id_holder_type_status_idx"
  ON "academic"."id_card_issues"("tenant_id", "holder_type", "status");
CREATE INDEX IF NOT EXISTS "id_card_issues_tenant_id_student_id_idx"
  ON "academic"."id_card_issues"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "id_card_issues_tenant_id_staff_profile_id_idx"
  ON "academic"."id_card_issues"("tenant_id", "staff_profile_id");
CREATE INDEX IF NOT EXISTS "id_card_issues_tenant_id_qr_payload_idx"
  ON "academic"."id_card_issues"("tenant_id", "qr_payload");

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_issues"
    ADD CONSTRAINT "id_card_issues_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_issues"
    ADD CONSTRAINT "id_card_issues_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_issues"
    ADD CONSTRAINT "id_card_issues_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "academic"."id_card_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Print requests queue
CREATE TABLE IF NOT EXISTS "academic"."id_card_print_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "holder_type" TEXT NOT NULL DEFAULT 'STUDENT',
    "student_id" UUID,
    "staff_profile_id" UUID,
    "issue_id" UUID,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requested_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "id_card_print_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "id_card_print_requests_tenant_id_status_created_at_idx"
  ON "academic"."id_card_print_requests"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "id_card_print_requests_tenant_id_student_id_idx"
  ON "academic"."id_card_print_requests"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "id_card_print_requests_tenant_id_staff_profile_id_idx"
  ON "academic"."id_card_print_requests"("tenant_id", "staff_profile_id");

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_print_requests"
    ADD CONSTRAINT "id_card_print_requests_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_print_requests"
    ADD CONSTRAINT "id_card_print_requests_staff_profile_id_fkey"
    FOREIGN KEY ("staff_profile_id") REFERENCES "academic"."staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."id_card_print_requests"
    ADD CONSTRAINT "id_card_print_requests_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "academic"."id_card_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
