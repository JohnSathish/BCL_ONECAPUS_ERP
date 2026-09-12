-- St. Luke's school SIS: yearly unique roll numbers SLS26-0001

WITH ranked AS (
  SELECT
    e.id,
    e.tenant_id,
    e.academic_year_id,
    COALESCE(substring(y.code FROM '20([0-9]{2})'), to_char(CURRENT_DATE, 'YY')) AS year_short,
    row_number() OVER (
      PARTITION BY e.tenant_id, e.academic_year_id
      ORDER BY
        COALESCE(
          NULLIF(substring(s.admission_number FROM '([0-9]{4})$'), '')::int,
          999999
        ),
        s.created_at,
        e.created_at
    ) AS seq
  FROM school.school_enrollments e
  JOIN school.school_academic_years y ON y.id = e.academic_year_id
  JOIN school.school_students s ON s.id = e.student_id
  WHERE e.deleted_at IS NULL
)
UPDATE school.school_enrollments e
SET roll_number = 'SLS' || r.year_short || '-' || lpad(r.seq::text, 4, '0')
FROM ranked r
WHERE e.id = r.id;

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

CREATE UNIQUE INDEX IF NOT EXISTS "school_enrollments_tenant_id_academic_year_id_roll_number_key"
  ON school.school_enrollments ("tenant_id", "academic_year_id", "roll_number");
