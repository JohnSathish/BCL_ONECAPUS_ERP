-- Library clearance cards. Independent of examination and admit-card tables.
-- One card per student, academic year, examination name and semester.

CREATE TABLE "library"."library_clearance_sequences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "year_code" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_clearance_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_clearance_sequences_tenant_id_year_code_key"
    ON "library"."library_clearance_sequences"("tenant_id", "year_code");

CREATE TABLE "library"."library_clearance_cards" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_number" TEXT NOT NULL,
    "verify_token" TEXT NOT NULL,
    "student_id" UUID NOT NULL,
    "academic_year" TEXT NOT NULL,
    "academic_year_key" TEXT NOT NULL,
    "examination_name" TEXT NOT NULL,
    "examination_key" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "semester_label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "books_returned" TEXT NOT NULL,
    "dues_status" TEXT NOT NULL,
    "lost_damaged_status" TEXT NOT NULL,
    "account_status" TEXT NOT NULL,
    "remarks" TEXT,
    "librarian_name" TEXT,
    "cleared_on" DATE,
    "student_name" TEXT NOT NULL,
    "roll_number" TEXT,
    "registration_number" TEXT,
    "programme" TEXT,
    "department" TEXT,
    "department_id" UUID,
    "program_id" UUID,
    "mobile_number" TEXT,
    "academic_session" TEXT,
    "active_loans" INTEGER NOT NULL DEFAULT 0,
    "outstanding_dues" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "open_incidents" INTEGER NOT NULL DEFAULT 0,
    "membership_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_clearance_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_clearance_cards_tenant_id_card_number_key"
    ON "library"."library_clearance_cards"("tenant_id", "card_number");

CREATE UNIQUE INDEX "library_clearance_cards_context_key"
    ON "library"."library_clearance_cards"("tenant_id", "student_id", "academic_year_key", "examination_key", "semester");

CREATE INDEX "library_clearance_cards_status_idx"
    ON "library"."library_clearance_cards"("tenant_id", "status");

CREATE INDEX "library_clearance_cards_lookup_idx"
    ON "library"."library_clearance_cards"("tenant_id", "academic_year_key", "examination_key", "semester");

CREATE INDEX "library_clearance_cards_student_idx"
    ON "library"."library_clearance_cards"("tenant_id", "student_id");

CREATE INDEX "library_clearance_cards_department_idx"
    ON "library"."library_clearance_cards"("tenant_id", "department_id");

CREATE TABLE "library"."library_clearance_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "library_clearance_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_clearance_events_card_idx"
    ON "library"."library_clearance_events"("tenant_id", "card_id", "created_at");

ALTER TABLE "library"."library_clearance_events"
    ADD CONSTRAINT "library_clearance_events_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "library"."library_clearance_cards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
