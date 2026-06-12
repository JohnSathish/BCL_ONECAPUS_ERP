CREATE TABLE IF NOT EXISTS "core"."support_board_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "subject_name" TEXT NOT NULL,
  "subject_code" TEXT NOT NULL,
  "board_type" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "support_board_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_board_subjects_tenant_id_subject_code_key"
  ON "core"."support_board_subjects"("tenant_id", "subject_code");

CREATE INDEX IF NOT EXISTS "support_board_subjects_tenant_id_is_active_idx"
  ON "core"."support_board_subjects"("tenant_id", "is_active");

CREATE INDEX IF NOT EXISTS "support_board_subjects_tenant_id_category_idx"
  ON "core"."support_board_subjects"("tenant_id", "category");

INSERT INTO "core"."support_board_subjects"
  ("tenant_id", "subject_code", "subject_name", "category", "board_type", "sort_order")
SELECT tenant.id, subject.code, subject.name, subject.category, 'GENERAL', subject.sort_order
FROM "platform"."tenants" tenant
CROSS JOIN (
  VALUES
    ('ENG', 'English', 'LANGUAGE', 1),
    ('ALT_ENG', 'Alternative English', 'LANGUAGE', 2),
    ('MIL', 'MIL', 'LANGUAGE', 3),
    ('GARO', 'Garo', 'LANGUAGE', 4),
    ('KHASI', 'Khasi', 'LANGUAGE', 5),
    ('HINDI', 'Hindi', 'LANGUAGE', 6),
    ('MATH', 'Mathematics', 'SCIENCE', 7),
    ('PHY', 'Physics', 'SCIENCE', 8),
    ('CHEM', 'Chemistry', 'SCIENCE', 9),
    ('BIO', 'Biology', 'SCIENCE', 10),
    ('BOT', 'Botany', 'SCIENCE', 11),
    ('ZOO', 'Zoology', 'SCIENCE', 12),
    ('ECO', 'Economics', 'ARTS', 13),
    ('EDU', 'Education', 'ARTS', 14),
    ('GEO', 'Geography', 'ARTS', 15),
    ('HIS', 'History', 'ARTS', 16),
    ('POL', 'Political Science', 'ARTS', 17),
    ('SOC', 'Sociology', 'ARTS', 18),
    ('CS', 'Computer Science', 'VOCATIONAL', 19),
    ('ACC', 'Accountancy', 'COMMERCE', 20),
    ('BST', 'Business Studies', 'COMMERCE', 21),
    ('ENT', 'Entrepreneurship', 'COMMERCE', 22),
    ('EVS', 'Environmental Studies', 'GENERAL', 23),
    ('STAT', 'Statistics', 'SCIENCE', 24)
) AS subject(code, name, category, sort_order)
ON CONFLICT ("tenant_id", "subject_code") DO NOTHING;
