-- Grant backup permissions to existing roles (idempotent)

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
SELECT gen_random_uuid(), v.slug, v.resource, v.action, v.description, now(), now()
FROM (VALUES
  ('backup:read', 'backup', 'read', 'View backup dashboard, repository, and logs'),
  ('backup:manage', 'backup', 'manage', 'Configure schedules, run manual backups, cloud settings'),
  ('backup:download', 'backup', 'download', 'Download backup artifacts'),
  ('backup:restore', 'backup', 'restore', 'Restore from backup (super-admin)')
) AS v(slug, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM platform.permissions p WHERE p.slug = v.slug AND p.deleted_at IS NULL
);

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN (
  'backup:read', 'backup:manage', 'backup:download', 'backup:restore'
)
WHERE r.slug IN ('college-admin', 'super-admin', 'university-admin')
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN ('backup:read', 'backup:manage', 'backup:download')
WHERE r.slug = 'institution-admin'
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO platform.backup_schedules (id, frequency, backup_type, enabled, next_run_at, created_at, updated_at)
SELECT gen_random_uuid(), 'DAILY', 'DATABASE_DOCUMENTS', true,
  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day' + interval '2 hours',
  now(), now()
WHERE NOT EXISTS (SELECT 1 FROM platform.backup_schedules WHERE tenant_id IS NULL);
