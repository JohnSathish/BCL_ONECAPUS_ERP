-- School SIS IAM: staff account link + invitations, scopes, alerts.

ALTER TABLE "school"."school_person_accounts"
  ADD COLUMN IF NOT EXISTS "staff_id" UUID;
CREATE INDEX IF NOT EXISTS "school_person_accounts_tenant_id_staff_id_idx"
  ON "school"."school_person_accounts"("tenant_id", "staff_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_person_accounts_staff_id_fkey'
  ) THEN
    ALTER TABLE "school"."school_person_accounts"
      ADD CONSTRAINT "school_person_accounts_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "school"."school_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "school"."school_user_scopes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "academic_year_id" UUID,
    "grade_id" UUID,
    "section_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'ASSIGNED_CLASS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_user_scopes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_user_scopes_tenant_id_user_id_idx"
  ON "school"."school_user_scopes"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "school_user_scopes_tenant_id_section_id_idx"
  ON "school"."school_user_scopes"("tenant_id", "section_id");

CREATE TABLE IF NOT EXISTS "school"."school_iam_invitations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_slug" TEXT,
    "token_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_iam_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_iam_invitations_token_hash_key"
  ON "school"."school_iam_invitations"("token_hash");
CREATE INDEX IF NOT EXISTS "school_iam_invitations_tenant_id_status_created_at_idx"
  ON "school"."school_iam_invitations"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "school_iam_invitations_tenant_id_user_id_idx"
  ON "school"."school_iam_invitations"("tenant_id", "user_id");

CREATE TABLE IF NOT EXISTS "school"."school_iam_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata_json" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_iam_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_iam_alerts_tenant_id_created_at_idx"
  ON "school"."school_iam_alerts"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "school"."school_iam_access_reviews" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "reviewed_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_iam_access_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "school_iam_access_reviews_tenant_id_created_at_idx"
  ON "school"."school_iam_access_reviews"("tenant_id", "created_at");
