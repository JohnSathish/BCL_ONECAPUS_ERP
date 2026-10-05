-- Semester 5 minors can share a course code with a major paper but use a different name.
ALTER TABLE "academic"."course_offerings"
ADD COLUMN IF NOT EXISTS "title_override" TEXT;

UPDATE "academic"."course_offerings" AS o
SET "title_override" = v.minor_title
FROM "academic"."courses" AS c,
(
  VALUES
    ('GEO-302', 'Geography and Environment'),
    ('EDN-302', 'Inclusive Education I'),
    ('BOT-302', 'Angiosperm Taxonomy, Ecology and Economic Botany'),
    ('CHE-302', 'General Chemistry – III'),
    ('MTH-302', 'Elementary Algebra'),
    ('PHY-302', 'Modern Physics I'),
    ('ZOO-302', 'Economic and Applied Zoology')
) AS v(code, minor_title)
WHERE o.course_id = c.id
  AND c.code = v.code
  AND o.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND upper(o.category) = 'MINOR'
  AND o.semester_sequence = 5
  AND btrim(c.title) IS DISTINCT FROM btrim(v.minor_title);
