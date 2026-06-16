-- Governance committee member enhancements (staff linkage, tenure, replacement)
ALTER TABLE "core"."governance_committee_members"
  ADD COLUMN IF NOT EXISTS "employee_code" TEXT,
  ADD COLUMN IF NOT EXISTS "department_name" TEXT,
  ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replaced_by_member_id" UUID;

CREATE INDEX IF NOT EXISTS "governance_committee_members_tenant_id_staff_profile_id_idx"
  ON "core"."governance_committee_members"("tenant_id", "staff_profile_id");
