-- IA Admit Card persistence and audit trail
CREATE TABLE "academic"."ia_admit_card_issues" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "admit_card_number" TEXT NOT NULL,
    "verify_token" TEXT NOT NULL,
    "verify_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "eligibility_snapshot" JSONB NOT NULL DEFAULT '{}',
    "card_snapshot" JSONB NOT NULL DEFAULT '{}',
    "generated_by_id" UUID,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "regenerated_count" INTEGER NOT NULL DEFAULT 0,
    "last_download_at" TIMESTAMP(3),
    "last_print_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ia_admit_card_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic"."ia_admit_card_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ia_admit_card_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ia_admit_card_issues_tenant_id_admit_card_number_key"
    ON "academic"."ia_admit_card_issues"("tenant_id", "admit_card_number");

CREATE UNIQUE INDEX "ia_admit_card_issues_tenant_id_session_id_student_id_key"
    ON "academic"."ia_admit_card_issues"("tenant_id", "session_id", "student_id");

CREATE INDEX "ia_admit_card_issues_tenant_id_session_id_idx"
    ON "academic"."ia_admit_card_issues"("tenant_id", "session_id");

CREATE INDEX "ia_admit_card_issues_tenant_id_verify_token_idx"
    ON "academic"."ia_admit_card_issues"("tenant_id", "verify_token");

CREATE INDEX "ia_admit_card_events_tenant_id_issue_id_idx"
    ON "academic"."ia_admit_card_events"("tenant_id", "issue_id");

CREATE INDEX "ia_admit_card_events_tenant_id_action_created_at_idx"
    ON "academic"."ia_admit_card_events"("tenant_id", "action", "created_at");

ALTER TABLE "academic"."ia_admit_card_issues"
    ADD CONSTRAINT "ia_admit_card_issues_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "academic"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."ia_admit_card_events"
    ADD CONSTRAINT "ia_admit_card_events_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "academic"."ia_admit_card_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
