export type IamAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'approve'
  | 'publish'
  | 'manage';

export type IamModuleDef = {
  id: string;
  label: string;
  actions: { action: IamAction; slug: string; label: string }[];
};

export const SCHOOL_IAM_MODULES: IamModuleDef[] = [
  {
    id: 'users',
    label: 'Users',
    actions: [
      { action: 'view', slug: 'users.view', label: 'View' },
      { action: 'create', slug: 'users.create', label: 'Create' },
      { action: 'edit', slug: 'users.update', label: 'Edit' },
      { action: 'delete', slug: 'users.delete', label: 'Delete' },
      { action: 'manage', slug: 'users.invite', label: 'Invite' },
    ],
  },
  {
    id: 'roles',
    label: 'Roles',
    actions: [
      { action: 'view', slug: 'roles.view', label: 'View' },
      { action: 'create', slug: 'roles.create', label: 'Create' },
      { action: 'edit', slug: 'roles.update', label: 'Edit' },
      { action: 'delete', slug: 'roles.delete', label: 'Delete' },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    actions: [
      { action: 'view', slug: 'students.view', label: 'View' },
      { action: 'create', slug: 'students.create', label: 'Create' },
      { action: 'edit', slug: 'students.update', label: 'Edit' },
      { action: 'delete', slug: 'students.delete', label: 'Delete' },
      { action: 'export', slug: 'students.export', label: 'Export' },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    actions: [
      { action: 'view', slug: 'attendance.view', label: 'View' },
      { action: 'create', slug: 'attendance.create', label: 'Mark' },
      { action: 'edit', slug: 'attendance.update', label: 'Edit' },
      { action: 'approve', slug: 'attendance.approve', label: 'Approve' },
      { action: 'manage', slug: 'attendance.lock', label: 'Lock / unlock' },
      {
        action: 'manage',
        slug: 'attendance.settings.manage',
        label: 'Settings',
      },
      { action: 'view', slug: 'attendance.leave.view', label: 'View leave' },
      {
        action: 'create',
        slug: 'attendance.leave.create',
        label: 'Request leave',
      },
      {
        action: 'approve',
        slug: 'attendance.leave.approve',
        label: 'Approve leave',
      },
      {
        action: 'export',
        slug: 'attendance.reports.export',
        label: 'Export reports',
      },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    actions: [
      { action: 'view', slug: 'hr.employees.view', label: 'View employees' },
      {
        action: 'manage',
        slug: 'hr.employees.manage',
        label: 'Manage employees',
      },
      { action: 'view', slug: 'hr.bank.reveal', label: 'Reveal bank / PAN' },
      { action: 'manage', slug: 'hr.leave.manage', label: 'Leave policies' },
      { action: 'approve', slug: 'hr.leave.approve', label: 'Approve leave' },
      { action: 'create', slug: 'hr.leave.create', label: 'Apply leave' },
      {
        action: 'create',
        slug: 'hr.attendance.mark',
        label: 'Staff attendance',
      },
      { action: 'view', slug: 'hr.self.view', label: 'Self service' },
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll',
    actions: [
      { action: 'view', slug: 'payroll.view', label: 'View' },
      { action: 'create', slug: 'payroll.calculate', label: 'Calculate' },
      {
        action: 'approve',
        slug: 'payroll.approve',
        label: 'Approve / reverse',
      },
      { action: 'manage', slug: 'payroll.pay', label: 'Pay' },
      { action: 'export', slug: 'payroll.reports.export', label: 'Export' },
    ],
  },
  {
    id: 'fees',
    label: 'Fees',
    actions: [
      { action: 'view', slug: 'fees.collection.view', label: 'View' },
      { action: 'create', slug: 'fees.collection.collect', label: 'Collect' },
      { action: 'edit', slug: 'fees.collection.refund', label: 'Refund' },
      { action: 'delete', slug: 'fees.collection.void', label: 'Void' },
      { action: 'export', slug: 'fees.reports.export', label: 'Export' },
    ],
  },
  {
    id: 'exams',
    label: 'Examination',
    actions: [
      { action: 'view', slug: 'exams.view', label: 'View' },
      { action: 'create', slug: 'exams.create', label: 'Create' },
      { action: 'edit', slug: 'exams.marks.enter', label: 'Enter marks' },
      { action: 'publish', slug: 'exams.results.publish', label: 'Publish' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    actions: [
      { action: 'view', slug: 'library.issue', label: 'Issue' },
      { action: 'edit', slug: 'library.return', label: 'Return' },
      { action: 'manage', slug: 'library.manage', label: 'Manage' },
    ],
  },
  {
    id: 'transport',
    label: 'Transport',
    actions: [
      { action: 'view', slug: 'transport.view', label: 'View' },
      { action: 'view', slug: 'transport.routes.view', label: 'Routes' },
      { action: 'view', slug: 'transport.vehicle.view', label: 'Vehicles' },
      { action: 'view', slug: 'transport.tracking.view', label: 'Tracking' },
      { action: 'view', slug: 'transport.fee.view', label: 'Fees' },
      { action: 'view', slug: 'transport.report.view', label: 'Reports' },
      { action: 'create', slug: 'transport.create', label: 'Create' },
      { action: 'edit', slug: 'transport.update', label: 'Update' },
      { action: 'delete', slug: 'transport.delete', label: 'Delete' },
      {
        action: 'manage',
        slug: 'transport.routes.manage',
        label: 'Manage routes',
      },
      {
        action: 'manage',
        slug: 'transport.vehicle.manage',
        label: 'Manage vehicles',
      },
      {
        action: 'manage',
        slug: 'transport.stop.manage',
        label: 'Manage stops',
      },
      {
        action: 'manage',
        slug: 'transport.driver.manage',
        label: 'Manage drivers',
      },
      {
        action: 'manage',
        slug: 'transport.allocation.manage',
        label: 'Allocations',
      },
      { action: 'manage', slug: 'transport.trip.manage', label: 'Trips' },
      {
        action: 'manage',
        slug: 'transport.attendance.manage',
        label: 'Attendance',
      },
      {
        action: 'manage',
        slug: 'transport.incident.manage',
        label: 'Incidents',
      },
      { action: 'manage', slug: 'transport.fee.manage', label: 'Manage fees' },
      {
        action: 'manage',
        slug: 'transport.settings.manage',
        label: 'Settings',
      },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    actions: [
      { action: 'view', slug: 'whatsapp.view', label: 'View' },
      { action: 'create', slug: 'whatsapp.send', label: 'Send' },
      { action: 'manage', slug: 'whatsapp.manage', label: 'Manage' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    actions: [
      { action: 'view', slug: 'notifications.view', label: 'View' },
      { action: 'create', slug: 'notifications.send', label: 'Send' },
      { action: 'manage', slug: 'notifications.manage', label: 'Manage' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    actions: [
      { action: 'view', slug: 'automation.view', label: 'View' },
      { action: 'create', slug: 'automation.create', label: 'Create' },
      { action: 'manage', slug: 'automation.manage', label: 'Manage' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    actions: [
      { action: 'view', slug: 'reports.view', label: 'View' },
      { action: 'export', slug: 'reports.export.pdf', label: 'PDF' },
      { action: 'export', slug: 'reports.export.excel', label: 'Excel' },
      { action: 'export', slug: 'reports.print', label: 'Print' },
      { action: 'export', slug: 'reports.financial', label: 'Financial' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    actions: [
      { action: 'view', slug: 'inventory.view', label: 'View' },
      { action: 'manage', slug: 'inventory.manage', label: 'Manage' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    actions: [
      { action: 'view', slug: 'security.audit.view', label: 'Audit' },
      { action: 'manage', slug: 'users.impersonate', label: 'Impersonate' },
    ],
  },
  {
    id: 'license',
    label: 'License',
    actions: [
      { action: 'view', slug: 'license:read', label: 'View' },
      { action: 'manage', slug: 'license:activate', label: 'Activate / renew' },
      { action: 'manage', slug: 'license.manage', label: 'Manage' },
    ],
  },
];

export const SCHOOL_IAM_ALL_SLUGS = [
  ...new Set(SCHOOL_IAM_MODULES.flatMap((m) => m.actions.map((a) => a.slug))),
  'school-sis:read',
  'school-sis:manage',
  'users:read',
  'users:manage',
  'users:impersonate',
  'rbac:manage',
  'school-mobile:staff',
  'school-mobile:student',
  'school-mobile:parent',
  'school-mobile:manage',
  'license:read',
  'license:activate',
  'license.manage',
];

const ALL_SCHOOL = SCHOOL_IAM_ALL_SLUGS;

export const SCHOOL_DEFAULT_ROLES: {
  slug: string;
  name: string;
  description: string;
  isSystem?: boolean;
  permissions: string[];
}[] = [
  {
    slug: 'college-admin',
    name: 'Super Administrator',
    description: 'Full school ERP access',
    isSystem: true,
    permissions: ALL_SCHOOL,
  },
  {
    slug: 'school-admin',
    name: 'School Administrator',
    description: 'School-wide administration except Super Admin security',
    permissions: ALL_SCHOOL.filter(
      (s) => s !== 'users.impersonate' && s !== 'users:impersonate',
    ),
  },
  {
    slug: 'principal',
    name: 'Principal',
    description: 'School-wide academic and operational access',
    isSystem: true,
    permissions: ALL_SCHOOL.filter(
      (s) => s !== 'users.impersonate' && s !== 'users:impersonate',
    ),
  },
  {
    slug: 'vice-principal',
    name: 'Vice Principal',
    description: 'Academic coordination',
    permissions: [
      'school-sis:read',
      'students.view',
      'students.update',
      'attendance.view',
      'attendance.approve',
      'attendance.lock',
      'attendance.update',
      'attendance.leave.view',
      'attendance.leave.approve',
      'hr.employees.view',
      'hr.leave.approve',
      'payroll.view',
      'payroll.approve',
      'exams.view',
      'exams.marks.enter',
      'exams.results.publish',
      'reports.view',
      'reports.export.pdf',
    ],
  },
  {
    slug: 'teacher',
    name: 'Teacher',
    description: 'Assigned classes only',
    permissions: [
      'school-sis:read',
      'school-mobile:staff',
      'students.view',
      'attendance.view',
      'attendance.create',
      'attendance.update',
      'attendance.leave.view',
      'attendance.leave.create',
      'hr.self.view',
      'hr.leave.create',
      'exams.view',
      'exams.marks.enter',
    ],
  },
  {
    slug: 'accountant',
    name: 'Accountant',
    description: 'Fees and collections',
    permissions: [
      'school-sis:read',
      'students.view',
      'fees.collection.view',
      'fees.collection.collect',
      'fees.collection.refund',
      'fees.reports.export',
      'reports.view',
      'reports.export.excel',
      'hr.employees.view',
      'payroll.view',
      'payroll.calculate',
      'payroll.pay',
      'payroll.reports.export',
    ],
  },
  {
    slug: 'fee-collector',
    name: 'Fee Collector',
    description: 'Counter collections only',
    permissions: [
      'school-sis:read',
      'students.view',
      'fees.collection.view',
      'fees.collection.collect',
    ],
  },
  {
    slug: 'exam-coordinator',
    name: 'Exam Coordinator',
    description: 'Examination office',
    permissions: [
      'school-sis:read',
      'students.view',
      'exams.view',
      'exams.create',
      'exams.marks.enter',
      'exams.results.publish',
    ],
  },
  {
    slug: 'librarian',
    name: 'Librarian',
    description: 'Library circulation',
    permissions: [
      'school-sis:read',
      'students.view',
      'library.issue',
      'library.return',
      'library.manage',
    ],
  },
  {
    slug: 'hr-manager',
    name: 'HR Manager',
    description: 'Staff records',
    permissions: [
      'school-sis:read',
      'users.view',
      'students.view',
      'hr.employees.view',
      'hr.employees.manage',
      'hr.bank.reveal',
      'hr.leave.manage',
      'hr.leave.approve',
      'hr.attendance.mark',
      'payroll.view',
    ],
  },
  {
    slug: 'transport-manager',
    name: 'Transport Manager',
    description: 'Routes and vehicles',
    permissions: [
      'school-sis:read',
      'students.view',
      'transport.view',
      'transport.routes.view',
      'transport.routes.manage',
      'transport.vehicle.view',
      'transport.vehicle.manage',
      'transport.stop.manage',
      'transport.driver.manage',
      'transport.allocation.manage',
      'transport.trip.manage',
      'transport.attendance.manage',
      'transport.tracking.view',
      'transport.incident.manage',
      'transport.fee.view',
      'transport.report.view',
      'transport.settings.manage',
    ],
  },
  {
    slug: 'receptionist',
    name: 'Receptionist',
    description: 'Front office',
    permissions: ['school-sis:read', 'students.view'],
  },
  {
    slug: 'store-manager',
    name: 'Store Manager',
    description: 'Stationery / inventory',
    permissions: ['school-sis:read', 'inventory.view', 'inventory.manage'],
  },
  {
    slug: 'office-staff',
    name: 'Office Staff',
    description: 'General office',
    permissions: [
      'school-sis:read',
      'school-mobile:staff',
      'students.view',
      'attendance.view',
      'attendance.create',
      'attendance.leave.view',
    ],
  },
  {
    slug: 'school-parent',
    name: 'Parent',
    description: 'Parent mobile access',
    permissions: ['school-mobile:parent'],
  },
  {
    slug: 'school-student',
    name: 'Student',
    description: 'Student mobile access',
    permissions: ['school-mobile:student'],
  },
  {
    slug: 'driver',
    name: 'Driver',
    description: 'Transport operations',
    permissions: [
      'transport.routes.view',
      'transport.tracking.view',
      'transport.attendance.manage',
      'school-mobile:staff',
    ],
  },
];

export const SUPER_ROLE_SLUGS = new Set(['college-admin', 'super-admin']);
