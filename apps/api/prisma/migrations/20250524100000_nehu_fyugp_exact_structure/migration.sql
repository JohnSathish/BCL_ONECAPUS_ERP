ALTER TABLE "academic"."program_structure_templates"
ADD COLUMN "degree_min_credits" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "semester_credit_target" INTEGER NOT NULL DEFAULT 20;

ALTER TABLE "academic"."semester_structure_rules"
ADD COLUMN "semester_credit_target" INTEGER;

CREATE TABLE "academic"."semester_structure_rule_lines" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "category_type" TEXT NOT NULL,
    "required_subject_count" INTEGER NOT NULL DEFAULT 0,
    "required_credits" DECIMAL(5,2),
    "continuity_rule" TEXT,
    "mandatory_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_structure_rule_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "semester_structure_rule_lines_rule_id_category_type_key"
ON "academic"."semester_structure_rule_lines"("rule_id", "category_type");

CREATE INDEX "semester_structure_rule_lines_rule_id_idx"
ON "academic"."semester_structure_rule_lines"("rule_id");

ALTER TABLE "academic"."semester_structure_rule_lines"
ADD CONSTRAINT "semester_structure_rule_lines_rule_id_fkey"
FOREIGN KEY ("rule_id") REFERENCES "academic"."semester_structure_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill lines from existing JSON category_counts
INSERT INTO "academic"."semester_structure_rule_lines" (
    "id",
    "rule_id",
    "category_type",
    "required_subject_count",
    "required_credits",
    "continuity_rule",
    "mandatory_flag",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    r.id,
    kv.key,
    COALESCE((kv.value)::text::int, 0),
    NULLIF((r.category_meta -> kv.key ->> 'creditRule'), '')::decimal,
    r.continuity_rules ->> kv.key,
    CASE
        WHEN r.category_meta -> kv.key ->> 'optional' = 'true' THEN false
        WHEN r.category_meta -> kv.key ->> 'mandatory' = 'false' THEN false
        ELSE true
    END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "academic"."semester_structure_rules" r
CROSS JOIN LATERAL jsonb_each(COALESCE(r.category_counts, '{}'::jsonb)) AS kv(key, value)
WHERE COALESCE((kv.value)::text::int, 0) > 0
ON CONFLICT ("rule_id", "category_type") DO NOTHING;

UPDATE "academic"."semester_structure_rules"
SET "semester_credit_target" = 20
WHERE "semester_credit_target" IS NULL;
