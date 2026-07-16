-- Alumni Management Module foundation
-- Expand alumni_profiles and add membership / events / donations / settings tables

ALTER TABLE "academic"."alumni_profiles"
  ADD COLUMN IF NOT EXISTS "membership_number" TEXT,
  ADD COLUMN IF NOT EXISTS "gender" TEXT,
  ADD COLUMN IF NOT EXISTS "date_of_birth" DATE,
  ADD COLUMN IF NOT EXISTS "blood_group" TEXT,
  ADD COLUMN IF NOT EXISTS "photo_url" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "current_address" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS "pin_code" TEXT,
  ADD COLUMN IF NOT EXISTS "occupation" TEXT,
  ADD COLUMN IF NOT EXISTS "office_address" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT,
  ADD COLUMN IF NOT EXISTS "facebook_url" TEXT,
  ADD COLUMN IF NOT EXISTS "instagram_url" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_name" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_mobile" TEXT,
  ADD COLUMN IF NOT EXISTS "emergency_relation" TEXT,
  ADD COLUMN IF NOT EXISTS "directory_visible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "profile_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP(3);

-- Widen status meaning (keep existing ACTIVE rows valid)
UPDATE "academic"."alumni_profiles"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL OR "status" = '';

CREATE UNIQUE INDEX IF NOT EXISTS "alumni_profiles_tenant_id_membership_number_key"
  ON "academic"."alumni_profiles"("tenant_id", "membership_number");

CREATE INDEX IF NOT EXISTS "alumni_profiles_tenant_id_status_idx"
  ON "academic"."alumni_profiles"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "alumni_profiles_tenant_id_graduation_year_idx"
  ON "academic"."alumni_profiles"("tenant_id", "graduation_year");

CREATE TABLE IF NOT EXISTS "academic"."alumni_membership_types" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "amount_paise" INTEGER NOT NULL DEFAULT 0,
  "duration_months" INTEGER,
  "is_lifetime" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_membership_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alumni_membership_types_tenant_id_code_key"
  ON "academic"."alumni_membership_types"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "alumni_membership_types_tenant_id_is_active_idx"
  ON "academic"."alumni_membership_types"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "academic"."alumni_memberships" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "alumni_id" UUID NOT NULL,
  "membership_type_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "starts_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_memberships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "alumni_memberships_tenant_id_alumni_id_idx"
  ON "academic"."alumni_memberships"("tenant_id", "alumni_id");

CREATE INDEX IF NOT EXISTS "alumni_memberships_tenant_id_status_idx"
  ON "academic"."alumni_memberships"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."alumni_payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "alumni_id" UUID NOT NULL,
  "membership_id" UUID,
  "amount_paise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "gateway" TEXT,
  "gateway_order_id" TEXT,
  "gateway_payment_id" TEXT,
  "receipt_number" TEXT,
  "paid_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "alumni_payments_tenant_id_alumni_id_idx"
  ON "academic"."alumni_payments"("tenant_id", "alumni_id");

CREATE INDEX IF NOT EXISTS "alumni_payments_tenant_id_status_idx"
  ON "academic"."alumni_payments"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."alumni_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT,
  "description" TEXT,
  "event_type" TEXT NOT NULL DEFAULT 'REUNION',
  "venue" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "cover_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alumni_events_tenant_id_slug_key"
  ON "academic"."alumni_events"("tenant_id", "slug");

CREATE INDEX IF NOT EXISTS "alumni_events_tenant_id_is_published_starts_at_idx"
  ON "academic"."alumni_events"("tenant_id", "is_published", "starts_at");

CREATE TABLE IF NOT EXISTS "academic"."alumni_event_registrations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "alumni_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_event_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alumni_event_registrations_event_id_alumni_id_key"
  ON "academic"."alumni_event_registrations"("event_id", "alumni_id");

CREATE INDEX IF NOT EXISTS "alumni_event_registrations_tenant_id_event_id_idx"
  ON "academic"."alumni_event_registrations"("tenant_id", "event_id");

CREATE TABLE IF NOT EXISTS "academic"."alumni_donations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "alumni_id" UUID,
  "donor_name" TEXT NOT NULL,
  "amount_paise" INTEGER NOT NULL,
  "campaign" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "receipt_number" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_donations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "alumni_donations_tenant_id_status_idx"
  ON "academic"."alumni_donations"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "academic"."alumni_committee_members" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "full_name" TEXT NOT NULL,
  "role_title" TEXT NOT NULL,
  "photo_url" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_committee_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "alumni_committee_members_tenant_id_is_active_idx"
  ON "academic"."alumni_committee_members"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "academic"."alumni_association_settings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "association_name" TEXT NOT NULL DEFAULT 'Alumni Association',
  "tagline" TEXT,
  "about_html" TEXT,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "address" TEXT,
  "logo_url" TEXT,
  "hero_image_url" TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#1A2B47',
  "accent_color" TEXT NOT NULL DEFAULT '#F3B63B',
  "stats_alumni" INTEGER NOT NULL DEFAULT 0,
  "stats_legacy_years" INTEGER NOT NULL DEFAULT 0,
  "stats_events" INTEGER NOT NULL DEFAULT 0,
  "stats_countries" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alumni_association_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alumni_association_settings_tenant_id_key"
  ON "academic"."alumni_association_settings"("tenant_id");

-- FKs (idempotent-ish: ignore if already present via DO blocks)
DO $$ BEGIN
  ALTER TABLE "academic"."alumni_memberships"
    ADD CONSTRAINT "alumni_memberships_alumni_id_fkey"
    FOREIGN KEY ("alumni_id") REFERENCES "academic"."alumni_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_memberships"
    ADD CONSTRAINT "alumni_memberships_membership_type_id_fkey"
    FOREIGN KEY ("membership_type_id") REFERENCES "academic"."alumni_membership_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_payments"
    ADD CONSTRAINT "alumni_payments_alumni_id_fkey"
    FOREIGN KEY ("alumni_id") REFERENCES "academic"."alumni_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_payments"
    ADD CONSTRAINT "alumni_payments_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "academic"."alumni_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_event_registrations"
    ADD CONSTRAINT "alumni_event_registrations_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "academic"."alumni_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_event_registrations"
    ADD CONSTRAINT "alumni_event_registrations_alumni_id_fkey"
    FOREIGN KEY ("alumni_id") REFERENCES "academic"."alumni_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "academic"."alumni_donations"
    ADD CONSTRAINT "alumni_donations_alumni_id_fkey"
    FOREIGN KEY ("alumni_id") REFERENCES "academic"."alumni_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
