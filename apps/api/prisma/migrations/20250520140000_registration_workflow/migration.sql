-- Registration workflow settings per institution (ADMIN_ONLY | STUDENT_SELF | HYBRID)
ALTER TABLE "core"."institution_academic_config"
  ADD COLUMN IF NOT EXISTS "registration_workflow" JSONB NOT NULL DEFAULT '{
    "mode": "ADMIN_ONLY",
    "allowStudentSelfService": false,
    "studentElectiveCategories": ["MDC", "SEC", "AEC", "VAC", "VTC"]
  }'::jsonb;
