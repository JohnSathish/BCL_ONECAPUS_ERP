-- Committee member registry: support internal, external, ex-officio, and representative types
ALTER TABLE "core"."governance_committee_members"
  ADD COLUMN IF NOT EXISTS "member_type" TEXT NOT NULL DEFAULT 'INTERNAL_STAFF',
  ADD COLUMN IF NOT EXISTS "organization" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "area_of_expertise" TEXT,
  ADD COLUMN IF NOT EXISTS "ex_officio_position" TEXT;

CREATE INDEX IF NOT EXISTS "governance_committee_members_tenant_member_type_idx"
  ON "core"."governance_committee_members" ("tenant_id", "member_type");
