-- Payroll RBAC permissions were added in seed but never inserted on existing databases.

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'payroll:read', 'payroll', 'read', 'View payroll dashboard, structures, and payslips', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:manage', 'payroll', 'manage', 'Manage salary components, structures, assignments, loans', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:process', 'payroll', 'process', 'Create and calculate payroll runs', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:verify', 'payroll', 'verify', 'Verify payroll runs', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:approve', 'payroll', 'approve', 'Approve payroll runs', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:publish', 'payroll', 'publish', 'Publish payroll runs', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:reports', 'payroll', 'reports', 'View and export payroll reports', NOW(), NOW()),
  (gen_random_uuid(), 'payroll:portal:self', 'payroll', 'portal:self', 'View own payslips, loans, and PF summary', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Full payroll access for top admin roles (all tenants).
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug IN ('college-admin', 'super-admin', 'institution-admin')
  AND p.slug IN (
    'payroll:read',
    'payroll:manage',
    'payroll:process',
    'payroll:verify',
    'payroll:approve',
    'payroll:publish',
    'payroll:reports',
    'payroll:portal:self'
  )
ON CONFLICT DO NOTHING;

-- Accounts staff: read + verify + reports + process (optional - seed only had read/verify/reports)
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug = 'accountant'
  AND p.slug IN ('payroll:read', 'payroll:verify', 'payroll:reports', 'payroll:process')
ON CONFLICT DO NOTHING;

-- Teaching staff portal payslips.
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug IN ('faculty', 'staff')
  AND p.slug = 'payroll:portal:self'
ON CONFLICT DO NOTHING;
