-- Admissions module: intakes, applications, merit lists, seat allocations

CREATE TABLE "academic"."admission_intakes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opens_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "admission_intakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."admission_applications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "intake_id" UUID NOT NULL,
    "application_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "merit_score" DECIMAL(8,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."merit_lists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "intake_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "merit_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."merit_list_entries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "merit_list_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merit_list_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."seat_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "intake_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'provisional',
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seat_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admission_intakes_tenant_id_code_key" ON "academic"."admission_intakes"("tenant_id", "code");
CREATE INDEX "admission_intakes_tenant_id_idx" ON "academic"."admission_intakes"("tenant_id");
CREATE INDEX "admission_intakes_program_id_idx" ON "academic"."admission_intakes"("program_id");

CREATE UNIQUE INDEX "admission_applications_intake_id_application_number_key" ON "academic"."admission_applications"("intake_id", "application_number");
CREATE INDEX "admission_applications_tenant_id_idx" ON "academic"."admission_applications"("tenant_id");
CREATE INDEX "admission_applications_intake_id_status_idx" ON "academic"."admission_applications"("intake_id", "status");

CREATE UNIQUE INDEX "merit_lists_intake_id_round_key" ON "academic"."merit_lists"("intake_id", "round");
CREATE INDEX "merit_lists_tenant_id_idx" ON "academic"."merit_lists"("tenant_id");

CREATE UNIQUE INDEX "merit_list_entries_merit_list_id_application_id_key" ON "academic"."merit_list_entries"("merit_list_id", "application_id");
CREATE UNIQUE INDEX "merit_list_entries_merit_list_id_rank_key" ON "academic"."merit_list_entries"("merit_list_id", "rank");
CREATE INDEX "merit_list_entries_tenant_id_idx" ON "academic"."merit_list_entries"("tenant_id");

CREATE UNIQUE INDEX "seat_allocations_intake_id_application_id_round_key" ON "academic"."seat_allocations"("intake_id", "application_id", "round");
CREATE INDEX "seat_allocations_tenant_id_idx" ON "academic"."seat_allocations"("tenant_id");

ALTER TABLE "academic"."admission_intakes" ADD CONSTRAINT "admission_intakes_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."admission_intakes" ADD CONSTRAINT "admission_intakes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "academic"."admission_applications" ADD CONSTRAINT "admission_applications_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "academic"."admission_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."merit_lists" ADD CONSTRAINT "merit_lists_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "academic"."admission_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."merit_list_entries" ADD CONSTRAINT "merit_list_entries_merit_list_id_fkey" FOREIGN KEY ("merit_list_id") REFERENCES "academic"."merit_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."merit_list_entries" ADD CONSTRAINT "merit_list_entries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "academic"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."seat_allocations" ADD CONSTRAINT "seat_allocations_intake_id_fkey" FOREIGN KEY ("intake_id") REFERENCES "academic"."admission_intakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic"."seat_allocations" ADD CONSTRAINT "seat_allocations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "academic"."admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
