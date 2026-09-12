-- Align school roll numbers with admission sequence: SLS/2026/0001 → SLS26-0001

DROP INDEX IF EXISTS school."school_enrollments_tenant_id_academic_year_id_roll_number_key";

WITH mapped AS (
  SELECT
    e.id,
    'SLS'
      || COALESCE(substring(y.code FROM '20([0-9]{2})'), to_char(CURRENT_DATE, 'YY'))
      || '-'
      || lpad(COALESCE(substring(s.admission_number FROM '([0-9]{4})$'), '0000'), 4, '0')
      AS roll
  FROM school.school_enrollments e
  JOIN school.school_academic_years y ON y.id = e.academic_year_id
  JOIN school.school_students s ON s.id = e.student_id
  WHERE e.deleted_at IS NULL
    AND s.admission_number ~ '[0-9]{4}$'
)
UPDATE school.school_enrollments e
SET roll_number = m.roll
FROM mapped m
WHERE e.id = m.id;

CREATE UNIQUE INDEX IF NOT EXISTS "school_enrollments_tenant_id_academic_year_id_roll_number_key"
  ON school.school_enrollments ("tenant_id", "academic_year_id", "roll_number");

INSERT INTO school.school_id_sequences (
  id,
  tenant_id,
  academic_year_id,
  kind,
  last_value
)
SELECT
  gen_random_uuid(),
  tenant_id,
  academic_year_id,
  'ROLL',
  MAX(
    COALESCE(
      NULLIF(substring(roll_number FROM '([0-9]{4})$'), '')::int,
      0
    )
  )
FROM school.school_enrollments
WHERE deleted_at IS NULL
  AND roll_number ~* '^SLS[0-9]{2}-[0-9]{4}$'
GROUP BY tenant_id, academic_year_id
ON CONFLICT (tenant_id, academic_year_id, kind)
DO UPDATE SET last_value = GREATEST(
  school.school_id_sequences.last_value,
  EXCLUDED.last_value
);
