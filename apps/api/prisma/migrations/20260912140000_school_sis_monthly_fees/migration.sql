-- St. Luke's monthly fee collection (Nursery–IV), year-scoped, no hard deletes

CREATE TABLE IF NOT EXISTS "school"."school_fee_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "due_day" INTEGER NOT NULL DEFAULT 15,
  "late_fee_amount" INTEGER NOT NULL DEFAULT 20,
  "late_fee_enabled" BOOLEAN NOT NULL DEFAULT true,
  "payment_methods" JSONB NOT NULL DEFAULT '["CASH","UPI","BANK","CHEQUE","OTHER"]',
  "receipt_prefix" TEXT NOT NULL DEFAULT 'FB',
  "signatory_name" TEXT,
  "school_name" TEXT NOT NULL DEFAULT 'St. Luke''s Secondary School',
  "school_address" TEXT NOT NULL DEFAULT 'Walbakgre, New Tura',
  "logo_url" TEXT,
  "instructions_json" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_settings_tenant_year_key"
  ON "school"."school_fee_settings"("tenant_id", "academic_year_id");

CREATE TABLE IF NOT EXISTS "school"."school_monthly_fee_plans" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "grade_id" UUID NOT NULL,
  "tuition_amount" INTEGER NOT NULL,
  "late_fee_amount" INTEGER,
  "other_amount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_monthly_fee_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_monthly_fee_plans_tenant_year_grade_key"
  ON "school"."school_monthly_fee_plans"("tenant_id", "academic_year_id", "grade_id");

CREATE TABLE IF NOT EXISTS "school"."school_fee_payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "enrollment_id" UUID,
  "grade_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "fee_month" TEXT NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "tuition_amount" INTEGER NOT NULL,
  "late_fee_amount" INTEGER NOT NULL DEFAULT 0,
  "other_amount" INTEGER NOT NULL DEFAULT 0,
  "discount_amount" INTEGER NOT NULL DEFAULT 0,
  "previous_balance" INTEGER NOT NULL DEFAULT 0,
  "total_amount" INTEGER NOT NULL,
  "payment_mode" TEXT NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collected_by_id" UUID,
  "snapshot_json" JSONB NOT NULL DEFAULT '{}',
  "voided_at" TIMESTAMP(3),
  "voided_by_id" UUID,
  "void_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_payments_receipt_key"
  ON "school"."school_fee_payments"("tenant_id", "receipt_number");
CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_payments_paid_month_key"
  ON "school"."school_fee_payments"("tenant_id", "academic_year_id", "student_id", "fee_month")
  WHERE "status" = 'PAID';
CREATE INDEX IF NOT EXISTS "school_fee_payments_month_idx"
  ON "school"."school_fee_payments"("tenant_id", "academic_year_id", "fee_month", "status");
CREATE INDEX IF NOT EXISTS "school_fee_payments_student_idx"
  ON "school"."school_fee_payments"("tenant_id", "student_id", "fee_month");
CREATE INDEX IF NOT EXISTS "school_fee_payments_paid_at_idx"
  ON "school"."school_fee_payments"("tenant_id", "paid_at");

CREATE TABLE IF NOT EXISTS "school"."school_fee_payment_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "actor_user_id" UUID,
  "note" TEXT,
  "before_json" JSONB,
  "after_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_payment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "school_fee_payment_events_payment_idx"
  ON "school"."school_fee_payment_events"("tenant_id", "payment_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_settings_year_fkey') THEN
    ALTER TABLE "school"."school_fee_settings"
      ADD CONSTRAINT "school_fee_settings_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_monthly_fee_plans_year_fkey') THEN
    ALTER TABLE "school"."school_monthly_fee_plans"
      ADD CONSTRAINT "school_monthly_fee_plans_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_monthly_fee_plans"
      ADD CONSTRAINT "school_monthly_fee_plans_grade_fkey"
      FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_payments_year_fkey') THEN
    ALTER TABLE "school"."school_fee_payments"
      ADD CONSTRAINT "school_fee_payments_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_fee_payments"
      ADD CONSTRAINT "school_fee_payments_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_payment_events_payment_fkey') THEN
    ALTER TABLE "school"."school_fee_payment_events"
      ADD CONSTRAINT "school_fee_payment_events_payment_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "school"."school_fee_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "school"."school_grades" ("id", "tenant_id", "code", "name", "sort_order", "active", "created_at", "updated_at")
SELECT gen_random_uuid(), g."tenant_id", 'LKG', 'LKG', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "tenant_id" FROM "school"."school_grades") g
WHERE NOT EXISTS (
  SELECT 1 FROM "school"."school_grades" x
  WHERE x."tenant_id" = g."tenant_id" AND x."code" = 'LKG' AND x."deleted_at" IS NULL
);
