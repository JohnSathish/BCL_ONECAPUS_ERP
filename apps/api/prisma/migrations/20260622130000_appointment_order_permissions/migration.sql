-- Appointment order permissions for HR roles
INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'hr:appointment:read', 'hr-appointment', 'read', 'View appointment orders and probation lists', NOW(), NOW()),
  (gen_random_uuid(), 'hr:appointment:manage', 'hr-appointment', 'manage', 'Create and manage appointment orders', NOW(), NOW()),
  (gen_random_uuid(), 'hr:appointment:issue', 'hr-appointment', 'issue', 'Generate and issue appointment order PDFs', NOW(), NOW()),
  (gen_random_uuid(), 'hr:joining:verify', 'hr-joining', 'verify', 'Verify joining reports and activate staff', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug IN ('college-admin', 'super-admin', 'institution-admin', 'principal')
  AND p.slug IN (
    'hr:appointment:read',
    'hr:appointment:manage',
    'hr:appointment:issue',
    'hr:joining:verify'
  )
ON CONFLICT DO NOTHING;
