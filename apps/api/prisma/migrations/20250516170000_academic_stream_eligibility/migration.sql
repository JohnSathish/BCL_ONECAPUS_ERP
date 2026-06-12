-- Academic stream master enhancements
ALTER TABLE "core"."academic_streams"
  ADD COLUMN IF NOT EXISTS "institution_id" UUID,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "academic_streams_institution_id_idx"
  ON "core"."academic_streams"("institution_id");

ALTER TABLE "core"."academic_streams"
  ADD CONSTRAINT "academic_streams_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Admission: mandatory academic stream on application
ALTER TABLE "academic"."admission_applications"
  ADD COLUMN IF NOT EXISTS "academic_stream_id" UUID;

CREATE INDEX IF NOT EXISTS "admission_applications_academic_stream_id_idx"
  ON "academic"."admission_applications"("academic_stream_id");

ALTER TABLE "academic"."admission_applications"
  ADD CONSTRAINT "admission_applications_academic_stream_id_fkey"
  FOREIGN KEY ("academic_stream_id") REFERENCES "core"."academic_streams"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Offering section stream eligibility (section-level)
CREATE TABLE IF NOT EXISTS "academic"."offering_section_streams" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offering_section_id" UUID NOT NULL,
  "academic_stream_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offering_section_streams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offering_section_streams_offering_section_id_academic_stream_id_key"
  ON "academic"."offering_section_streams"("offering_section_id", "academic_stream_id");

CREATE INDEX IF NOT EXISTS "offering_section_streams_academic_stream_id_idx"
  ON "academic"."offering_section_streams"("academic_stream_id");

ALTER TABLE "academic"."offering_section_streams"
  ADD CONSTRAINT "offering_section_streams_offering_section_id_fkey"
  FOREIGN KEY ("offering_section_id") REFERENCES "academic"."offering_sections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic"."offering_section_streams"
  ADD CONSTRAINT "offering_section_streams_academic_stream_id_fkey"
  FOREIGN KEY ("academic_stream_id") REFERENCES "core"."academic_streams"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Default streams per demo tenant (idempotent)
INSERT INTO "core"."academic_streams" ("id", "tenant_id", "code", "name", "description", "display_order", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), t.id, v.code, v.name, v.description, v.display_order, true, NOW(), NOW()
FROM "platform"."tenants" t
CROSS JOIN (
  VALUES
    ('ARTS', 'Arts', 'Humanities and arts programmes', 1),
    ('SCIENCE', 'Science', 'Science programmes', 2),
    ('COMMERCE', 'Commerce', 'Commerce and business programmes', 3)
) AS v(code, name, description, display_order)
WHERE t.slug = 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM "core"."academic_streams" s
    WHERE s.tenant_id = t.id AND s.code = v.code AND s.deleted_at IS NULL
  );

-- Backfill student profiles without stream (default to SCIENCE)
UPDATE "academic"."student_academic_profiles" p
SET "stream_id" = s.id
FROM "core"."academic_streams" s
WHERE p.stream_id IS NULL
  AND s.tenant_id = p.tenant_id
  AND s.code = 'SCIENCE'
  AND s.deleted_at IS NULL;
