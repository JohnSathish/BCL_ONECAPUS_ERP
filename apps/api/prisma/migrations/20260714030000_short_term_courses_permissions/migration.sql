-- Short-term courses permissions + role grants (idempotent)

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
SELECT gen_random_uuid(), v.slug, v.resource, v.action, v.description, now(), now()
FROM (VALUES
  ('short-term-courses:read', 'short-term-courses', 'read', 'View short-term courses catalogue, batches, and reports'),
  ('short-term-courses:manage', 'short-term-courses', 'manage', 'Create and manage short-term courses, batches, fees, and certificates'),
  ('short-term-courses:mark-attendance', 'short-term-courses', 'mark-attendance', 'Mark short-term course session attendance'),
  ('short-term-courses:self', 'short-term-courses', 'self', 'Student self-service for short-term course registration and materials')
) AS v(slug, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM platform.permissions p WHERE p.slug = v.slug AND p.deleted_at IS NULL
);

-- Full manage for campus admins / leadership
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN (
  'short-term-courses:read',
  'short-term-courses:manage',
  'short-term-courses:mark-attendance'
)
WHERE r.slug IN (
  'college-admin',
  'super-admin',
  'university-admin',
  'institution-admin',
  'principal',
  'vice-principal'
)
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- HOD: manage + attendance
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN (
  'short-term-courses:read',
  'short-term-courses:manage',
  'short-term-courses:mark-attendance'
)
WHERE r.slug = 'hod'
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Faculty: read + mark attendance
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN (
  'short-term-courses:read',
  'short-term-courses:mark-attendance'
)
WHERE r.slug IN ('faculty', 'teacher')
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- Students: self-service
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug = 'short-term-courses:self'
WHERE r.slug IN ('student', 'students')
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
