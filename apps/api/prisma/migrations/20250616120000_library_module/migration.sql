-- Smart Library Phase 1

CREATE SCHEMA IF NOT EXISTS "library";

CREATE TABLE "library"."library_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "total_seats" INTEGER NOT NULL DEFAULT 200,
    "fine_per_day" DECIMAL(10,2) NOT NULL DEFAULT 5,
    "grace_days" INTEGER NOT NULL DEFAULT 0,
    "max_fine" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "default_loan_days" INTEGER NOT NULL DEFAULT 14,
    "room_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_settings_tenant_id_key" ON "library"."library_settings"("tenant_id");

CREATE TABLE "library"."library_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_categories_tenant_id_code_key" ON "library"."library_categories"("tenant_id", "code");
CREATE INDEX "library_categories_tenant_id_active_idx" ON "library"."library_categories"("tenant_id", "active");

CREATE TABLE "library"."library_visitors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pass_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "mobile" TEXT,
    "institution" TEXT,
    "purpose" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_visitors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_visitors_tenant_id_pass_number_key" ON "library"."library_visitors"("tenant_id", "pass_number");
CREATE INDEX "library_visitors_tenant_id_idx" ON "library"."library_visitors"("tenant_id");

CREATE TABLE "library"."library_visits" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "member_type" TEXT NOT NULL,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "visitor_id" UUID,
    "entry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exit_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "hall_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_visits_tenant_id_member_type_student_id_exit_at_idx" ON "library"."library_visits"("tenant_id", "member_type", "student_id", "exit_at");
CREATE INDEX "library_visits_tenant_id_member_type_staff_profile_id_exit_at_idx" ON "library"."library_visits"("tenant_id", "member_type", "staff_profile_id", "exit_at");
CREATE INDEX "library_visits_tenant_id_member_type_visitor_id_exit_at_idx" ON "library"."library_visits"("tenant_id", "member_type", "visitor_id", "exit_at");
CREATE INDEX "library_visits_tenant_id_entry_at_idx" ON "library"."library_visits"("tenant_id", "entry_at");
CREATE INDEX "library_visits_tenant_id_exit_at_idx" ON "library"."library_visits"("tenant_id", "exit_at");

ALTER TABLE "library"."library_visits" ADD CONSTRAINT "library_visits_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "library"."library_visitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "library"."library_books" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "accession_no" TEXT NOT NULL,
    "book_number" TEXT,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "department_id" UUID,
    "category_id" UUID,
    "price" DECIMAL(12,2),
    "shelf" TEXT,
    "rack" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "total_copies" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_books_tenant_id_accession_no_key" ON "library"."library_books"("tenant_id", "accession_no");
CREATE INDEX "library_books_tenant_id_status_idx" ON "library"."library_books"("tenant_id", "status");
CREATE INDEX "library_books_tenant_id_category_id_idx" ON "library"."library_books"("tenant_id", "category_id");
CREATE INDEX "library_books_tenant_id_department_id_idx" ON "library"."library_books"("tenant_id", "department_id");

CREATE TABLE "library"."library_book_copies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "copy_number" INTEGER NOT NULL DEFAULT 1,
    "barcode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_book_copies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "library_book_copies_tenant_id_barcode_key" ON "library"."library_book_copies"("tenant_id", "barcode");
CREATE UNIQUE INDEX "library_book_copies_tenant_id_book_id_copy_number_key" ON "library"."library_book_copies"("tenant_id", "book_id", "copy_number");
CREATE INDEX "library_book_copies_tenant_id_status_idx" ON "library"."library_book_copies"("tenant_id", "status");

ALTER TABLE "library"."library_book_copies" ADD CONSTRAINT "library_book_copies_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library"."library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "library"."library_books" ADD CONSTRAINT "library_books_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "library"."library_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "library"."library_loans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "copy_id" UUID NOT NULL,
    "member_type" TEXT NOT NULL,
    "student_id" UUID,
    "staff_profile_id" UUID,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "returned_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issued_by_id" UUID,
    "returned_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_loans_tenant_id_status_idx" ON "library"."library_loans"("tenant_id", "status");
CREATE INDEX "library_loans_tenant_id_student_id_status_idx" ON "library"."library_loans"("tenant_id", "student_id", "status");
CREATE INDEX "library_loans_tenant_id_staff_profile_id_status_idx" ON "library"."library_loans"("tenant_id", "staff_profile_id", "status");
CREATE INDEX "library_loans_tenant_id_due_at_idx" ON "library"."library_loans"("tenant_id", "due_at");

ALTER TABLE "library"."library_loans" ADD CONSTRAINT "library_loans_copy_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "library"."library_book_copies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "library"."library_fines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_fines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_fines_tenant_id_loan_id_idx" ON "library"."library_fines"("tenant_id", "loan_id");

ALTER TABLE "library"."library_fines" ADD CONSTRAINT "library_fines_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "library"."library_loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "library"."library_reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_reservations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_reservations_tenant_id_book_id_status_idx" ON "library"."library_reservations"("tenant_id", "book_id", "status");
CREATE INDEX "library_reservations_tenant_id_student_id_status_idx" ON "library"."library_reservations"("tenant_id", "student_id", "status");

ALTER TABLE "library"."library_reservations" ADD CONSTRAINT "library_reservations_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "library"."library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "library"."library_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "library_audit_logs_tenant_id_action_created_at_idx" ON "library"."library_audit_logs"("tenant_id", "action", "created_at");
