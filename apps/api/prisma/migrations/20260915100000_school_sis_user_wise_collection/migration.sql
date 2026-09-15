-- User-wise collection report indexes + daily cash close (St. Luke's SIS)

CREATE INDEX IF NOT EXISTS "school_fee_payments_collector_paid_idx"
  ON "school"."school_fee_payments"("tenant_id", "collected_by_id", "paid_at", "status");

CREATE INDEX IF NOT EXISTS "school_fee_payments_mode_status_paid_idx"
  ON "school"."school_fee_payments"("tenant_id", "payment_mode", "status", "paid_at");

CREATE INDEX IF NOT EXISTS "school_fee_payments_grade_section_status_idx"
  ON "school"."school_fee_payments"("tenant_id", "grade_id", "section_id", "status");

CREATE TABLE IF NOT EXISTS "school"."school_fee_cash_closes" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "opening_cash" INTEGER NOT NULL,
  "cash_collected" INTEGER NOT NULL,
  "cash_refunds" INTEGER NOT NULL DEFAULT 0,
  "expected_closing" INTEGER NOT NULL,
  "actual_cash_count" INTEGER NOT NULL,
  "difference" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_by_id" UUID NOT NULL,
  "reopened_at" TIMESTAMP(3),
  "reopened_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "school_fee_cash_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_fee_cash_closes_user_date_key"
  ON "school"."school_fee_cash_closes"("tenant_id", "user_id", "business_date");

CREATE INDEX IF NOT EXISTS "school_fee_cash_closes_date_idx"
  ON "school"."school_fee_cash_closes"("tenant_id", "business_date", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_fee_cash_closes_year_fkey') THEN
    ALTER TABLE "school"."school_fee_cash_closes"
      ADD CONSTRAINT "school_fee_cash_closes_year_fkey"
      FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
