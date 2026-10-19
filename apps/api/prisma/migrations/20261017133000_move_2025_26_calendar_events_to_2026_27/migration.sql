-- Move current-session events that were saved on the 2025-26 calendar onto 2026-27.
-- Events before 1 Jun 2026 stay on 2025-26. Identical events already on 2026-27 are left in place.
-- October 2026 on the active calendar is replaced when 2025-26 has October events,
-- so the old duplicated exam rows do not stay beside the copied month.

UPDATE "academic"."academic_calendar_events" e
SET
  "deleted_at" = NOW(),
  "active" = false,
  "updated_at" = NOW()
WHERE e."deleted_at" IS NULL
  AND e."start_date" <= DATE '2026-10-31'
  AND e."end_date" >= DATE '2026-10-01'
  AND e."calendar_id" IN (
    SELECT c."id"
    FROM "academic"."academic_calendars" c
    JOIN "core"."academic_years" y ON y."id" = c."academic_year_id"
    WHERE c."deleted_at" IS NULL
      AND y."deleted_at" IS NULL
      AND (
        regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
        OR regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
      )
      AND (
        y."is_primary_session" = true
        OR y."status" = 'ACTIVE'
        OR y."start_date" <= DATE '2026-10-17'
      )
  )
  AND EXISTS (
    SELECT 1
    FROM "academic"."academic_calendar_events" src
    JOIN "academic"."academic_calendars" sc ON sc."id" = src."calendar_id"
    JOIN "core"."academic_years" sy ON sy."id" = sc."academic_year_id"
    WHERE src."deleted_at" IS NULL
      AND src."active" = true
      AND sy."deleted_at" IS NULL
      AND src."start_date" <= DATE '2026-10-31'
      AND src."end_date" >= DATE '2026-10-01'
      AND (
        regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
        OR regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
      )
      AND regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
      AND regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') NOT LIKE '%20262027%'
  );

WITH chosen_target AS (
  SELECT *
  FROM (
    SELECT
      y."id" AS year_id,
      y."tenant_id",
      y."institution_id",
      y."name",
      ROW_NUMBER() OVER (
        PARTITION BY y."tenant_id", y."institution_id"
        ORDER BY (y."is_primary_session" OR y."status" = 'ACTIVE') DESC, y."start_date" DESC
      ) AS rn
    FROM "core"."academic_years" y
    WHERE y."deleted_at" IS NULL
      AND (
        regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
        OR regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
      )
  ) ranked
  WHERE rn = 1
),
sources AS (
  SELECT
    y."tenant_id",
    y."institution_id",
    c."id" AS calendar_id,
    c."status" AS calendar_status
  FROM "core"."academic_years" y
  JOIN "academic"."academic_calendars" c
    ON c."academic_year_id" = y."id"
  WHERE y."deleted_at" IS NULL
    AND (
      regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
    AND regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') NOT LIKE '%20262027%'
),
inserted AS (
  INSERT INTO "academic"."academic_calendars" (
    "id",
    "tenant_id",
    "institution_id",
    "academic_year_id",
    "title",
    "status",
    "weekend_days",
    "published_at",
    "created_at",
    "updated_at"
  )
  SELECT
    gen_random_uuid(),
    t."tenant_id",
    t."institution_id",
    t.year_id,
    t."name" || ' Academic Calendar',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM sources s
        WHERE s."tenant_id" = t."tenant_id"
          AND s."institution_id" = t."institution_id"
          AND s.calendar_status = 'PUBLISHED'
      ) THEN 'PUBLISHED'
      ELSE 'DRAFT'
    END,
    '[0]'::jsonb,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM sources s
        WHERE s."tenant_id" = t."tenant_id"
          AND s."institution_id" = t."institution_id"
          AND s.calendar_status = 'PUBLISHED'
      ) THEN NOW()
      ELSE NULL
    END,
    NOW(),
    NOW()
  FROM chosen_target t
  WHERE NOT EXISTS (
    SELECT 1
    FROM "academic"."academic_calendars" c
    WHERE c."academic_year_id" = t.year_id
      AND c."deleted_at" IS NULL
  )
  RETURNING "id", "academic_year_id"
),
target_calendars AS (
  SELECT
    t."tenant_id",
    t."institution_id",
    COALESCE(c."id", i."id") AS calendar_id
  FROM chosen_target t
  LEFT JOIN "academic"."academic_calendars" c
    ON c."academic_year_id" = t.year_id
   AND c."deleted_at" IS NULL
  LEFT JOIN inserted i
    ON i."academic_year_id" = t.year_id
),
moved AS (
  UPDATE "academic"."academic_calendar_events" e
  SET
    "calendar_id" = tc.calendar_id,
    "updated_at" = NOW()
  FROM sources s
  JOIN target_calendars tc
    ON tc."tenant_id" = s."tenant_id"
   AND tc."institution_id" = s."institution_id"
  WHERE e."calendar_id" = s.calendar_id
    AND e."deleted_at" IS NULL
    AND e."active" = true
    AND e."start_date" >= DATE '2026-06-01'
    AND e."start_date" < DATE '2027-07-01'
    AND tc.calendar_id IS NOT NULL
    AND e."calendar_id" <> tc.calendar_id
    AND NOT EXISTS (
      SELECT 1
      FROM "academic"."academic_calendar_events" d
      WHERE d."calendar_id" = tc.calendar_id
        AND d."deleted_at" IS NULL
        AND d."type" = e."type"
        AND d."title" = e."title"
        AND d."start_date" = e."start_date"
        AND d."end_date" = e."end_date"
        AND d."shift_id" IS NOT DISTINCT FROM e."shift_id"
    )
  RETURNING e."id", e."calendar_id"
)
UPDATE "academic"."academic_calendars" cal
SET
  "status" = 'PUBLISHED',
  "published_at" = COALESCE(cal."published_at", NOW()),
  "updated_at" = NOW()
WHERE cal."id" IN (SELECT "calendar_id" FROM moved)
  AND cal."status" <> 'PUBLISHED'
  AND EXISTS (
    SELECT 1
    FROM sources s
    JOIN target_calendars tc
      ON tc."tenant_id" = s."tenant_id"
     AND tc."institution_id" = s."institution_id"
    WHERE tc.calendar_id = cal."id"
      AND s.calendar_status = 'PUBLISHED'
  );

-- Handbook planner: fill blank 2026-27 days from the 2025-26 planner, then hide the copied source day.
WITH planner_target AS (
  SELECT *
  FROM (
    SELECT
      y."id",
      y."tenant_id",
      y."site_id",
      ROW_NUMBER() OVER (
        PARTITION BY y."tenant_id", y."site_id"
        ORDER BY (y."status" = 'PUBLISHED') DESC, y."start_date" DESC
      ) AS rn
    FROM "academic"."website_academic_planner_years" y
    WHERE y."deleted_at" IS NULL
      AND (
        regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
        OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
      )
  ) ranked
  WHERE rn = 1
),
planner_source AS (
  SELECT y."id", y."tenant_id", y."site_id"
  FROM "academic"."website_academic_planner_years" y
  WHERE y."deleted_at" IS NULL
    AND (
      regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
)
UPDATE "academic"."website_academic_planner_days" dest
SET
  "status_label" = src."status_label",
  "description" = src."description",
  "is_working_day" = src."is_working_day",
  "is_highlighted" = src."is_highlighted",
  "updated_at" = NOW()
FROM "academic"."website_academic_planner_days" src
JOIN planner_source sy ON sy."id" = src."year_id"
JOIN planner_target ty
  ON ty."tenant_id" = sy."tenant_id"
 AND ty."site_id" = sy."site_id"
WHERE dest."year_id" = ty."id"
  AND dest."date" = src."date"
  AND dest."deleted_at" IS NULL
  AND src."deleted_at" IS NULL
  AND src."date" >= DATE '2026-06-01'
  AND src."date" < DATE '2027-07-01'
  AND btrim(COALESCE(dest."description", '')) = ''
  AND dest."is_working_day" = true
  AND lower(btrim(COALESCE(dest."status_label", ''))) IN ('', 'class', 'working', 'working day')
  AND NOT (
    btrim(COALESCE(src."description", '')) = ''
    AND src."is_working_day" = true
    AND lower(btrim(COALESCE(src."status_label", ''))) IN ('', 'class', 'working', 'working day')
  );

WITH planner_target AS (
  SELECT *
  FROM (
    SELECT
      y."id",
      y."tenant_id",
      y."site_id",
      ROW_NUMBER() OVER (
        PARTITION BY y."tenant_id", y."site_id"
        ORDER BY (y."status" = 'PUBLISHED') DESC, y."start_date" DESC
      ) AS rn
    FROM "academic"."website_academic_planner_years" y
    WHERE y."deleted_at" IS NULL
      AND (
        regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
        OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
      )
  ) ranked
  WHERE rn = 1
),
planner_source AS (
  SELECT y."id", y."tenant_id", y."site_id"
  FROM "academic"."website_academic_planner_years" y
  WHERE y."deleted_at" IS NULL
    AND (
      regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
)
UPDATE "academic"."website_academic_planner_days" src
SET
  "year_id" = ty."id",
  "updated_at" = NOW()
FROM planner_source sy
JOIN planner_target ty
  ON ty."tenant_id" = sy."tenant_id"
 AND ty."site_id" = sy."site_id"
WHERE src."year_id" = sy."id"
  AND src."deleted_at" IS NULL
  AND src."date" >= DATE '2026-06-01'
  AND src."date" < DATE '2027-07-01'
  AND NOT EXISTS (
    SELECT 1
    FROM "academic"."website_academic_planner_days" dest
    WHERE dest."year_id" = ty."id"
      AND dest."date" = src."date"
      AND dest."deleted_at" IS NULL
  );

WITH planner_target AS (
  SELECT *
  FROM (
    SELECT
      y."id",
      y."tenant_id",
      y."site_id",
      ROW_NUMBER() OVER (
        PARTITION BY y."tenant_id", y."site_id"
        ORDER BY (y."status" = 'PUBLISHED') DESC, y."start_date" DESC
      ) AS rn
    FROM "academic"."website_academic_planner_years" y
    WHERE y."deleted_at" IS NULL
      AND (
        regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
        OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
      )
  ) ranked
  WHERE rn = 1
),
planner_source AS (
  SELECT y."id", y."tenant_id", y."site_id"
  FROM "academic"."website_academic_planner_years" y
  WHERE y."deleted_at" IS NULL
    AND (
      regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
)
UPDATE "academic"."website_academic_planner_days" src
SET
  "deleted_at" = NOW(),
  "updated_at" = NOW()
FROM planner_source sy
JOIN planner_target ty
  ON ty."tenant_id" = sy."tenant_id"
 AND ty."site_id" = sy."site_id"
JOIN "academic"."website_academic_planner_days" dest
  ON dest."year_id" = ty."id"
 AND dest."deleted_at" IS NULL
WHERE src."year_id" = sy."id"
  AND dest."date" = src."date"
  AND src."deleted_at" IS NULL
  AND src."date" >= DATE '2026-06-01'
  AND src."date" < DATE '2027-07-01'
  AND dest."status_label" = src."status_label"
  AND dest."description" = src."description"
  AND dest."is_working_day" = src."is_working_day";

-- Drop exact duplicate events, keeping the earliest row.
WITH ranked_events AS (
  SELECT
    e."id",
    ROW_NUMBER() OVER (
      PARTITION BY
        e."calendar_id",
        e."type",
        e."title",
        e."start_date",
        e."end_date",
        e."shift_id"
      ORDER BY e."created_at" ASC, e."id" ASC
    ) AS rn
  FROM "academic"."academic_calendar_events" e
  WHERE e."deleted_at" IS NULL
    AND e."active" = true
)
UPDATE "academic"."academic_calendar_events" e
SET
  "deleted_at" = NOW(),
  "active" = false,
  "updated_at" = NOW()
FROM ranked_events r
WHERE e."id" = r."id"
  AND r.rn > 1;

-- When 2025-26 has no academic-calendar October, copy notable handbook days
-- onto the active calendar and remove the old October rows first.
WITH planner_october AS (
  SELECT
    d."tenant_id",
    d."date",
    d."status_label",
    d."description",
    d."is_working_day",
    y."site_id"
  FROM "academic"."website_academic_planner_days" d
  JOIN "academic"."website_academic_planner_years" y ON y."id" = d."year_id"
  WHERE d."deleted_at" IS NULL
    AND y."deleted_at" IS NULL
    AND d."date" >= DATE '2026-10-01'
    AND d."date" <= DATE '2026-10-31'
    AND (
      regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(y."title"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
    AND NOT (
      d."is_working_day" = true
      AND btrim(COALESCE(d."description", '')) = ''
      AND lower(btrim(COALESCE(d."status_label", ''))) IN ('', 'class', 'working', 'working day')
    )
),
active_calendar AS (
  SELECT c."id", c."tenant_id", c."institution_id"
  FROM "academic"."academic_calendars" c
  JOIN "core"."academic_years" y ON y."id" = c."academic_year_id"
  WHERE c."deleted_at" IS NULL
    AND y."deleted_at" IS NULL
    AND (
      regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%202627%'
      OR regexp_replace(lower(y."name"), '[^a-z0-9]', '', 'g') LIKE '%20262027%'
    )
    AND (y."is_primary_session" = true OR y."status" = 'ACTIVE')
),
source_october AS (
  SELECT 1
  FROM "academic"."academic_calendar_events" src
  JOIN "academic"."academic_calendars" sc ON sc."id" = src."calendar_id"
  JOIN "core"."academic_years" sy ON sy."id" = sc."academic_year_id"
  WHERE src."deleted_at" IS NULL
    AND sy."deleted_at" IS NULL
    AND src."start_date" <= DATE '2026-10-31'
    AND src."end_date" >= DATE '2026-10-01'
    AND (
      regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') LIKE '%202526%'
      OR regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') LIKE '%20252026%'
    )
    AND regexp_replace(lower(sy."name"), '[^a-z0-9]', '', 'g') NOT LIKE '%202627%'
  LIMIT 1
),
cleared AS (
  UPDATE "academic"."academic_calendar_events" e
  SET
    "deleted_at" = NOW(),
    "active" = false,
    "updated_at" = NOW()
  WHERE e."deleted_at" IS NULL
    AND e."start_date" <= DATE '2026-10-31'
    AND e."end_date" >= DATE '2026-10-01'
    AND e."calendar_id" IN (SELECT "id" FROM active_calendar)
    AND NOT EXISTS (SELECT 1 FROM source_october)
    AND EXISTS (SELECT 1 FROM planner_october)
  RETURNING e."id"
)
INSERT INTO "academic"."academic_calendar_events" (
  "id",
  "tenant_id",
  "calendar_id",
  "type",
  "title",
  "description",
  "start_date",
  "end_date",
  "is_working_day",
  "creates_attendance_session",
  "scope_type",
  "visibility",
  "active",
  "is_all_day",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  cal."tenant_id",
  cal."id",
  CASE
    WHEN lower(p."status_label") LIKE '%holiday%'
      OR lower(p."description") LIKE '%holiday%'
      OR lower(p."description") LIKE '%puja%'
      THEN 'COLLEGE_HOLIDAY'
    WHEN lower(p."status_label") LIKE '%exam%'
      OR lower(p."description") LIKE '%exam%'
      OR lower(p."description") LIKE '%assessment%'
      THEN 'INTERNAL_ASSESSMENT'
    WHEN lower(p."status_label") LIKE '%fee%'
      OR lower(p."description") LIKE '%fee%'
      THEN 'FEE_DUE'
    ELSE 'INSTITUTIONAL_EVENT'
  END,
  LEFT(
    COALESCE(
      NULLIF(btrim(p."description"), ''),
      NULLIF(btrim(p."status_label"), ''),
      'Calendar'
    ),
    180
  ),
  NULLIF(btrim(p."status_label"), ''),
  p."date",
  p."date",
  p."is_working_day",
  false,
  'INSTITUTION',
  'INTERNAL',
  true,
  true,
  NOW(),
  NOW()
FROM planner_october p
JOIN active_calendar cal ON cal."tenant_id" = p."tenant_id"
WHERE NOT EXISTS (SELECT 1 FROM source_october)
  AND NOT EXISTS (
    SELECT 1
    FROM "academic"."academic_calendar_events" existing
    WHERE existing."calendar_id" = cal."id"
      AND existing."deleted_at" IS NULL
      AND existing."start_date" = p."date"
      AND existing."title" = LEFT(
        COALESCE(
          NULLIF(btrim(p."description"), ''),
          NULLIF(btrim(p."status_label"), ''),
          'Calendar'
        ),
        180
      )
  );
