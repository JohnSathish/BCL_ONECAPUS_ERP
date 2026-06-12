/** Read access for payroll/HR screens (dashboard, assignments, structures, etc.). */
export const PAYROLL_READ_ACCESS = [
  'payroll:read',
  'payroll:manage',
  'payroll:reports',
  'staff:read',
  'staff:manage',
] as const;

/** Full payroll module permissions for institution-level admins. */
export const INSTITUTION_ADMIN_PAYROLL = [
  'payroll:read',
  'payroll:manage',
  'payroll:process',
  'payroll:verify',
  'payroll:approve',
  'payroll:publish',
  'payroll:reports',
] as const;
