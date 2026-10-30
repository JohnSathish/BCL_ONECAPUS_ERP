CREATE TABLE IF NOT EXISTS "library"."library_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID,
  "staff_profile_id" UUID,
  "member_kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "block_reason" TEXT,
  "block_note" TEXT,
  "blocked_at" TIMESTAMP(3),
  "blocked_by_id" UUID,
  "loan_limit" INTEGER,
  "loan_days" INTEGER,
  "max_renewals" INTEGER,
  "fine_exempt" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" DATE,
  "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_memberships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "library_memberships_one_person" CHECK (
    ("student_id" IS NOT NULL AND "staff_profile_id" IS NULL)
    OR ("student_id" IS NULL AND "staff_profile_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "library_memberships_tenant_id_student_id_key"
  ON "library"."library_memberships" ("tenant_id", "student_id")
  WHERE "student_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "library_memberships_tenant_id_staff_profile_id_key"
  ON "library"."library_memberships" ("tenant_id", "staff_profile_id")
  WHERE "staff_profile_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "library_memberships_tenant_id_status_idx"
  ON "library"."library_memberships" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "library_memberships_tenant_id_member_kind_idx"
  ON "library"."library_memberships" ("tenant_id", "member_kind");

CREATE TABLE IF NOT EXISTS "library"."library_membership_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "note" TEXT,
  "actor_id" UUID,
  "before" JSONB,
  "after" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "library_membership_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_membership_events_tenant_id_membership_id_created_at_idx"
  ON "library"."library_membership_events" ("tenant_id", "membership_id", "created_at");

CREATE INDEX IF NOT EXISTS "library_membership_events_tenant_id_action_created_at_idx"
  ON "library"."library_membership_events" ("tenant_id", "action", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_membership_events_membership_id_fkey'
  ) THEN
    ALTER TABLE "library"."library_membership_events"
      ADD CONSTRAINT "library_membership_events_membership_id_fkey"
      FOREIGN KEY ("membership_id") REFERENCES "library"."library_memberships"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "library"."library_member_sync_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "actor_id" UUID,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "library_member_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "library_member_sync_runs_tenant_id_started_at_idx"
  ON "library"."library_member_sync_runs" ("tenant_id", "started_at");
