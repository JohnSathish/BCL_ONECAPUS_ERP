-- Display-name only: NEP 2020 FYUP programme titles (NEHU).
-- Relationships use program_id / program_version_id UUIDs; code and PKs are unchanged.
-- Safe to re-run: updates only when code or legacy Bachelor name matches.

UPDATE academic.programs
SET name = 'FYUP in Economics', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-ECO' OR name = 'Bachelor of Arts in Economics');

UPDATE academic.programs
SET name = 'FYUP in Education', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-EDU' OR name = 'Bachelor of Arts in Education');

UPDATE academic.programs
SET name = 'FYUP in English', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-ENG' OR name = 'Bachelor of Arts in English');

UPDATE academic.programs
SET name = 'FYUP in Garo', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-GAR' OR name = 'Bachelor of Arts in Garo');

UPDATE academic.programs
SET name = 'FYUP in Geography', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-GEO' OR name = 'Bachelor of Arts in Geography');

UPDATE academic.programs
SET name = 'FYUP in History', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-HIS' OR name = 'Bachelor of Arts in History');

UPDATE academic.programs
SET name = 'FYUP in Philosophy', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-PHI' OR name = 'Bachelor of Arts in Philosophy');

UPDATE academic.programs
SET name = 'FYUP in Political Science', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-POL' OR name = 'Bachelor of Arts in Political Science');

UPDATE academic.programs
SET name = 'FYUP in Sociology', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BA-SOC' OR name = 'Bachelor of Arts in Sociology');

UPDATE academic.programs
SET name = 'FYUP in Commerce', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BCOM' OR name = 'Bachelor of Commerce');

UPDATE academic.programs
SET name = 'FYUP in Physics', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BSC-PHY' OR name = 'Bachelor of Science in Physics');

UPDATE academic.programs
SET name = 'FYUP in Chemistry', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BSC-CHE' OR name = 'Bachelor of Science in Chemistry');

UPDATE academic.programs
SET name = 'FYUP in Mathematics', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BSC-MTH' OR name = 'Bachelor of Science in Mathematics');

UPDATE academic.programs
SET name = 'FYUP in Botany', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BSC-BOT' OR name = 'Bachelor of Science in Botany');

UPDATE academic.programs
SET name = 'FYUP in Zoology', updated_at = NOW()
WHERE deleted_at IS NULL
  AND (code = 'BSC-ZOO' OR name = 'Bachelor of Science in Zoology');
