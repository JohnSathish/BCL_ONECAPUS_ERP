-- One staff profile has at most one PF config (required for Prisma 1:1 relation)
CREATE UNIQUE INDEX IF NOT EXISTS "staff_pf_configs_staff_profile_id_key"
  ON "finance"."staff_pf_configs" ("staff_profile_id");
