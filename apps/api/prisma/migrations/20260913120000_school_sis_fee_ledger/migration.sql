-- Multi-month collection: receipt lines + month accounts. Never hard-delete payments.

ALTER TABLE "school"."school_fee_payments"
  ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'OFFICE',
  ADD COLUMN IF NOT EXISTS "gross_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "remaining_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_type" TEXT,
  ADD COLUMN IF NOT EXISTS "discount_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "discount_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "cheque_number" TEXT,
  ADD COLUMN IF NOT EXISTS "bank_name" TEXT,
  ADD COLUMN IF NOT EXISTS "months_json" JSONB NOT NULL DEFAULT '[]';

DROP INDEX IF EXISTS "school"."school_fee_payments_paid_month_key";

CREATE TABLE IF NOT EXISTS "school"."school_fee_payment_lines" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "fee_month" TEXT NOT NULL,
  "tuition_amount" INTEGER NOT NULL,
  "other_amount" INTEGER NOT NULL DEFAULT 0,
  "late_fee_amount" INTEGER NOT NULL DEFAULT 0,
  "late_waived" BOOLEAN NOT NULL DEFAULT false,
  "late_waive_reason" TEXT,
  "due_amount" INTEGER NOT NULL,
  "paid_amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_payment_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_payment_lines_payment_month_key"
  ON "school"."school_fee_payment_lines"("payment_id", "fee_month");
CREATE INDEX IF NOT EXISTS "school_fee_payment_lines_month_idx"
  ON "school"."school_fee_payment_lines"("tenant_id", "fee_month", "status");

CREATE TABLE IF NOT EXISTS "school"."school_fee_month_accounts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "fee_month" TEXT NOT NULL,
  "due_amount" INTEGER NOT NULL,
  "paid_amount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DUE',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_month_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_month_accounts_unique"
  ON "school"."school_fee_month_accounts"("tenant_id", "academic_year_id", "student_id", "fee_month");
CREATE INDEX IF NOT EXISTS "school_fee_month_accounts_status_idx"
  ON "school"."school_fee_month_accounts"("tenant_id", "academic_year_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_payment_lines_payment_fkey') THEN
    ALTER TABLE "school"."school_fee_payment_lines"
      ADD CONSTRAINT "school_fee_payment_lines_payment_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "school"."school_fee_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_month_accounts_year_fkey') THEN
    ALTER TABLE "school"."school_fee_month_accounts"
      ADD CONSTRAINT "school_fee_month_accounts_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "school"."school_fee_month_accounts"
      ADD CONSTRAINT "school_fee_month_accounts_student_fkey"
      FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill fully paid months from existing receipts
INSERT INTO "school"."school_fee_month_accounts" (
  "id", "tenant_id", "academic_year_id", "student_id", "fee_month", "due_amount", "paid_amount", "status", "updated_at"
)
SELECT gen_random_uuid(), p."tenant_id", p."academic_year_id", p."student_id", p."fee_month",
       p."total_amount", p."total_amount", 'PAID', CURRENT_TIMESTAMP
FROM "school"."school_fee_payments" p
WHERE p."status" = 'PAID'
ON CONFLICT ("tenant_id", "academic_year_id", "student_id", "fee_month") DO NOTHING;

INSERT INTO "school"."school_fee_payment_lines" (
  "id", "tenant_id", "payment_id", "fee_month", "tuition_amount", "other_amount", "late_fee_amount",
  "due_amount", "paid_amount", "status"
)
SELECT gen_random_uuid(), p."tenant_id", p."id", p."fee_month", p."tuition_amount", p."other_amount", p."late_fee_amount",
       p."total_amount", p."total_amount", 'PAID'
FROM "school"."school_fee_payments" p
WHERE p."status" = 'PAID'
  AND NOT EXISTS (
    SELECT 1 FROM "school"."school_fee_payment_lines" l WHERE l."payment_id" = p."id"
  );
