-- Grant payroll permissions to institution-admin role (HRMS access for college admins)

INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.slug = 'institution-admin'
  AND p.slug IN (
    'payroll:read',
    'payroll:manage',
    'payroll:process',
    'payroll:verify',
    'payroll:approve',
    'payroll:publish',
    'payroll:reports'
  )
ON CONFLICT DO NOTHING;
