-- Enterprise module permissions + role grants (idempotent)

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
SELECT gen_random_uuid(), v.slug, v.resource, v.action, v.description, now(), now()
FROM (VALUES
  ('workflow:read', 'workflow', 'read', 'View workflow definitions, inbox, and audit'),
  ('workflow:manage', 'workflow', 'manage', 'Create and manage workflow definitions and actions'),
  ('helpdesk:read', 'helpdesk', 'read', 'View support tickets and comments'),
  ('helpdesk:manage', 'helpdesk', 'manage', 'Assign, transition, and manage support tickets'),
  ('parent-portal:read', 'parent-portal', 'read', 'View parent–student links'),
  ('parent-portal:manage', 'parent-portal', 'manage', 'Manage parent–student links'),
  ('parent:portal:self', 'parent', 'portal:self', 'Parent self-service ward views'),
  ('visitor-management:read', 'visitor-management', 'read', 'View visitor visits'),
  ('visitor-management:manage', 'visitor-management', 'manage', 'Check-in and check-out visitors'),
  ('placement:read', 'placement', 'read', 'View placement recruiters, drives, and applications'),
  ('placement:manage', 'placement', 'manage', 'Manage placement recruiters, drives, and applications'),
  ('internship:read', 'internship', 'read', 'View internship companies and placements'),
  ('internship:manage', 'internship', 'manage', 'Manage internship companies and placements'),
  ('alumni:read', 'alumni', 'read', 'View alumni profiles'),
  ('alumni:manage', 'alumni', 'manage', 'Manage alumni profiles'),
  ('hostel:read', 'hostel', 'read', 'View hostel blocks, rooms, and allotments'),
  ('hostel:manage', 'hostel', 'manage', 'Manage hostel blocks, rooms, and allotments'),
  ('research:read', 'research', 'read', 'View research grants'),
  ('research:manage', 'research', 'manage', 'Manage research grants'),
  ('integrations:read', 'integrations', 'read', 'View integration connectors and SSO config'),
  ('integrations:manage', 'integrations', 'manage', 'Manage integration connectors and SSO config')
) AS v(slug, resource, action, description)
WHERE NOT EXISTS (
  SELECT 1 FROM platform.permissions p WHERE p.slug = v.slug AND p.deleted_at IS NULL
);

-- Full manage for campus admins / leadership
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug IN (
  'workflow:read',
  'workflow:manage',
  'helpdesk:read',
  'helpdesk:manage',
  'parent-portal:read',
  'parent-portal:manage',
  'visitor-management:read',
  'visitor-management:manage',
  'placement:read',
  'placement:manage',
  'internship:read',
  'internship:manage',
  'alumni:read',
  'alumni:manage',
  'hostel:read',
  'hostel:manage',
  'research:read',
  'research:manage',
  'integrations:read',
  'integrations:manage'
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

-- Parent role: self-service
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug = 'parent:portal:self'
WHERE r.slug IN ('parent', 'parents', 'guardian')
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
