-- Course delivery structure (theory / practical / mixed)
ALTER TABLE "academic"."courses"
  ADD COLUMN IF NOT EXISTS "delivery_type" TEXT NOT NULL DEFAULT 'THEORY',
  ADD COLUMN IF NOT EXISTS "has_practical" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "theory_credits" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "practical_credits" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "theory_hours_per_week" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "practical_hours_per_week" INTEGER NOT NULL DEFAULT 0;

UPDATE "academic"."courses"
SET
  "theory_credits" = "credits",
  "practical_credits" = 0,
  "delivery_type" = 'THEORY',
  "has_practical" = false
WHERE "theory_credits" = 0 AND "practical_credits" = 0;

CREATE INDEX IF NOT EXISTS "courses_delivery_type_idx" ON "academic"."courses"("delivery_type");
CREATE INDEX IF NOT EXISTS "courses_has_practical_idx" ON "academic"."courses"("has_practical");

-- Room types for timetable / lab allocation
CREATE TABLE IF NOT EXISTS "academic"."room_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_types_tenant_id_code_key"
  ON "academic"."room_types"("tenant_id", "code");

ALTER TABLE "academic"."classrooms"
  ADD COLUMN IF NOT EXISTS "room_type_id" UUID;

ALTER TABLE "academic"."classrooms"
  ADD CONSTRAINT "classrooms_room_type_id_fkey"
  FOREIGN KEY ("room_type_id") REFERENCES "academic"."room_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "academic"."room_types" ("id", "tenant_id", "code", "name", "description", "sort_order")
SELECT gen_random_uuid(), t.id, v.code, v.name, v.description, v.sort_order
FROM "platform"."tenants" t
CROSS JOIN (
  VALUES
    ('CLASSROOM', 'Classroom', 'Theory lectures', 1),
    ('LAB', 'Laboratory', 'Practical / lab sessions', 2),
    ('SEMINAR', 'Seminar room', 'Seminars and tutorials', 3),
    ('STUDIO', 'Studio', 'Studio-intensive delivery', 4)
) AS v(code, name, description, sort_order)
WHERE t.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM "academic"."room_types" r
    WHERE r.tenant_id = t.id AND r.code = v.code
  );

-- Delivery-based fee rules
CREATE TABLE IF NOT EXISTS "finance"."fee_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rule_type" TEXT NOT NULL,
  "delivery_types" JSONB NOT NULL DEFAULT '[]',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fee_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fee_rules_tenant_id_code_key"
  ON "finance"."fee_rules"("tenant_id", "code");

CREATE INDEX IF NOT EXISTS "fee_rules_tenant_id_is_active_idx"
  ON "finance"."fee_rules"("tenant_id", "is_active");

-- Demo lab fee rules
INSERT INTO "finance"."fee_rules" ("id", "tenant_id", "code", "name", "rule_type", "delivery_types", "amount", "metadata")
SELECT gen_random_uuid(), t.id, v.code, v.name, v.rule_type, v.delivery_types::jsonb, v.amount, v.metadata::jsonb
FROM "platform"."tenants" t
CROSS JOIN (
  VALUES
    (
      'LAB-PRACTICAL-COURSE',
      'Practical course lab fee',
      'PER_PRACTICAL_COURSE',
      '["PRACTICAL","THEORY_PRACTICAL","STUDIO"]',
      1500.00,
      '{"category":"general_lab"}'
    ),
    (
      'SCIENCE-LAB-SURCHARGE',
      'Science practical surcharge',
      'PER_PRACTICAL_COURSE',
      '["PRACTICAL","THEORY_PRACTICAL"]',
      800.00,
      '{"category":"science_lab","subjectPrefixes":["PHY","CHE","BIO"]}'
    )
) AS v(code, name, rule_type, delivery_types, amount, metadata)
WHERE t.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM "finance"."fee_rules" f
    WHERE f.tenant_id = t.id AND f.code = v.code
  );
