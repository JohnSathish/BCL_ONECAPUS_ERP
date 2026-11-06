-- Department streams keep their own roll prefix (EC, ED, EN, ...) instead of BA/BS/BC.
INSERT INTO platform.roll_prefix_configs (
  id, tenant_id, stream_id, prefix, is_active, created_at, updated_at
)
SELECT gen_random_uuid(), stream.tenant_id, stream.id, map.prefix, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM core.academic_streams AS stream
JOIN (
  VALUES
    ('ECONOMICS', 'EC'),
    ('EDUCATION', 'ED'),
    ('ENGLISH', 'EN'),
    ('GARO', 'GA'),
    ('GEOGRAPHY', 'GE'),
    ('HISTORY', 'HI'),
    ('PHILOSOPHY', 'PHI'),
    ('POLITICAL_SCIENCE', 'PS'),
    ('SOCIOLOGY', 'SO'),
    ('COMMERCE', 'COM'),
    ('BOTANY', 'BOT'),
    ('CHEMISTRY', 'CHE'),
    ('MATHEMATICS', 'MAT'),
    ('PHYSICS', 'PHY'),
    ('ZOOLOGY', 'ZOO')
) AS map(code, prefix) ON stream.code = map.code
WHERE stream.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM platform.roll_prefix_configs AS existing
    WHERE existing.tenant_id = stream.tenant_id
      AND existing.stream_id = stream.id
  );

UPDATE platform.roll_prefix_configs AS cfg
SET prefix = map.prefix,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
FROM core.academic_streams AS stream
JOIN (
  VALUES
    ('ECONOMICS', 'EC'),
    ('EDUCATION', 'ED'),
    ('ENGLISH', 'EN'),
    ('GARO', 'GA'),
    ('GEOGRAPHY', 'GE'),
    ('HISTORY', 'HI'),
    ('PHILOSOPHY', 'PHI'),
    ('POLITICAL_SCIENCE', 'PS'),
    ('SOCIOLOGY', 'SO'),
    ('COMMERCE', 'COM'),
    ('BOTANY', 'BOT'),
    ('CHEMISTRY', 'CHE'),
    ('MATHEMATICS', 'MAT'),
    ('PHYSICS', 'PHY'),
    ('ZOOLOGY', 'ZOO')
) AS map(code, prefix) ON stream.code = map.code
WHERE cfg.stream_id = stream.id
  AND cfg.prefix IN ('BA', 'BS', 'BC');
