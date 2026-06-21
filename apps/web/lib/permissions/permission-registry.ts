/**
 * ERP permission registry — keep in sync with apps/api/src/common/permissions/permission-registry.ts
 */

export const SUPER_ADMIN_ROLES = ['college-admin', 'super-admin', 'university-admin'] as const;

/** Permission slugs grouped by ERP module (any-of grants module visibility). */
export const MODULE_PERMISSIONS = {
  dashboard: [
    'reports:read',
    'students:read',
    'academic:read',
    'fees:read',
    'front-office:read',
    'library:read',
  ],
  admissions: ['admissions:read', 'admissions:manage', 'students:read'],
  students: ['students:read', 'students:manage'],
  academics: [
    'academic:read',
    'academic:manage',
    'academic-engine:read',
    'academic-engine:manage',
    'academic-lifecycle:read',
    'academic-lifecycle:manage',
  ],
  staff: ['staff:read', 'staff:manage', 'staff-attendance:view'],
  timetable: ['academic:timetable:manage', 'academic-engine:read', 'academic-engine:manage'],
  lms: ['lms:read', 'lms:manage'],
  questionBank: [
    'question-bank:read',
    'question-bank:manage',
    'question-bank:contribute',
    'question-bank:approve',
    'question-bank:publish',
  ],
  studentAttendance: ['students:read', 'students:manage', 'academic:read'],
  staffAttendance: [
    'staff-attendance:view',
    'staff-attendance:edit',
    'staff-attendance:shift-admin',
  ],
  examinations: [
    'exam:view',
    'exam:admin',
    'exam:create',
    'exam:edit',
    'ia:view',
    'ia:manage',
    'ia:marks:enter',
  ],
  certificates: ['certificates:read', 'certificates:manage', 'certificates:approve'],
  finance: ['fees:read', 'fees:manage', 'fees:cash:collect'],
  library: [
    'library:read',
    'library:manage',
    'library:circulate',
    'library:reports',
    'library:access-desk',
    'library:digital:read',
    'library:digital:manage',
    'library:research:read',
    'library:research:manage',
  ],
  cams: ['cams:read', 'cams:manage', 'cams:reports'],
  infrastructure: ['org:read', 'org:manage'],
  frontOffice: [
    'front-office:read',
    'front-office:desk',
    'front-office:manage',
    'front-office:reports',
  ],
  governance: [
    'governance:read',
    'governance:manage',
    'governance:publish',
    'governance:reports',
    'governance:import',
    'governance:portal',
  ],
  naacIqac: [
    'naac-iqac:read',
    'naac-iqac:manage',
    'naac-iqac:collect',
    'naac-iqac:publish',
    'naac-iqac:reports',
    'naac-iqac:portal',
  ],
  communication: ['communication:read', 'communication:manage'],
  transport: ['transport:read', 'transport:manage', 'transport:assign'],
  inventory: ['inventory:read', 'inventory:manage', 'inventory:issue'],
  reports: ['reports:read', 'students:read', 'academic:read', 'fees:read'],
  administration: [
    'users:read',
    'users:manage',
    'rbac:manage',
    'audit:read',
    'license:read',
    'license:activate',
    'backup:read',
    'backup:manage',
    'backup:download',
    'backup:restore',
  ],
  platform: ['platform:licenses:read', 'platform:licenses:manage'],
  settings: ['org:read', 'org:manage', 'users:read'],
  shifts: ['shift:read', 'shift:manage'],
  hr: [
    'payroll:read',
    'payroll:manage',
    'payroll:process',
    'payroll:reports',
    'accommodation:read',
    'accommodation:manage',
    'accommodation:reports',
  ],
} as const;

export type ErpModuleId = keyof typeof MODULE_PERMISSIONS;

export type ErpModule = {
  id: ErpModuleId;
  label: string;
  permissions: readonly string[];
  defaultHome: string;
};

export const ERP_MODULES: ErpModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    permissions: MODULE_PERMISSIONS.dashboard,
    defaultHome: '/admin',
  },
  {
    id: 'admissions',
    label: 'Admissions',
    permissions: MODULE_PERMISSIONS.admissions,
    defaultHome: '/admin/admissions',
  },
  {
    id: 'students',
    label: 'Students',
    permissions: MODULE_PERMISSIONS.students,
    defaultHome: '/admin/students',
  },
  {
    id: 'academics',
    label: 'Academics',
    permissions: MODULE_PERMISSIONS.academics,
    defaultHome: '/admin/programs',
  },
  {
    id: 'staff',
    label: 'Staff',
    permissions: MODULE_PERMISSIONS.staff,
    defaultHome: '/admin/staff',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    permissions: MODULE_PERMISSIONS.timetable,
    defaultHome: '/admin/academics/timetable',
  },
  {
    id: 'lms',
    label: 'LMS',
    permissions: MODULE_PERMISSIONS.lms,
    defaultHome: '/admin/academics/lms',
  },
  {
    id: 'questionBank',
    label: 'Question Bank',
    permissions: MODULE_PERMISSIONS.questionBank,
    defaultHome: '/admin/academics/question-bank',
  },
  {
    id: 'studentAttendance',
    label: 'Student Attendance',
    permissions: MODULE_PERMISSIONS.studentAttendance,
    defaultHome: '/admin/academics/attendance',
  },
  {
    id: 'staffAttendance',
    label: 'Staff Attendance',
    permissions: MODULE_PERMISSIONS.staffAttendance,
    defaultHome: '/admin/staff/attendance',
  },
  {
    id: 'examinations',
    label: 'Examinations',
    permissions: MODULE_PERMISSIONS.examinations,
    defaultHome: '/admin/academics/examinations',
  },
  {
    id: 'certificates',
    label: 'Certificates',
    permissions: MODULE_PERMISSIONS.certificates,
    defaultHome: '/admin/certificates',
  },
  {
    id: 'finance',
    label: 'Fees & Finance',
    permissions: MODULE_PERMISSIONS.finance,
    defaultHome: '/admin/fees',
  },
  {
    id: 'hr',
    label: 'Human Resources',
    permissions: MODULE_PERMISSIONS.hr,
    defaultHome: '/admin/hr',
  },
  {
    id: 'library',
    label: 'Library',
    permissions: MODULE_PERMISSIONS.library,
    defaultHome: '/admin/library',
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    permissions: MODULE_PERMISSIONS.infrastructure,
    defaultHome: '/admin/organization/infrastructure',
  },
  {
    id: 'frontOffice',
    label: 'Front Office',
    permissions: MODULE_PERMISSIONS.frontOffice,
    defaultHome: '/admin/front-office',
  },
  {
    id: 'governance',
    label: 'Governance & Committees',
    permissions: MODULE_PERMISSIONS.governance,
    defaultHome: '/admin/governance',
  },
  {
    id: 'naacIqac',
    label: 'NAAC & IQAC',
    permissions: MODULE_PERMISSIONS.naacIqac,
    defaultHome: '/admin/naac',
  },
  {
    id: 'communication',
    label: 'Communication',
    permissions: MODULE_PERMISSIONS.communication,
    defaultHome: '/admin/communication',
  },
  {
    id: 'transport',
    label: 'Transport',
    permissions: MODULE_PERMISSIONS.transport,
    defaultHome: '/admin/transport',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    permissions: MODULE_PERMISSIONS.inventory,
    defaultHome: '/admin/inventory',
  },
  {
    id: 'reports',
    label: 'Reports',
    permissions: MODULE_PERMISSIONS.reports,
    defaultHome: '/admin/reports',
  },
  {
    id: 'administration',
    label: 'Administration',
    permissions: MODULE_PERMISSIONS.administration,
    defaultHome: '/admin/administration',
  },
  {
    id: 'platform',
    label: 'Platform',
    permissions: MODULE_PERMISSIONS.platform,
    defaultHome: '/platform',
  },
  {
    id: 'settings',
    label: 'Settings',
    permissions: MODULE_PERMISSIONS.settings,
    defaultHome: '/admin/organization',
  },
  {
    id: 'shifts',
    label: 'Shifts',
    permissions: MODULE_PERMISSIONS.shifts,
    defaultHome: '/admin/shifts',
  },
];

/** Flat list of all permissions that grant /admin portal access. */
export const ALL_ADMIN_MODULE_PERMISSIONS: string[] = [
  ...new Set(ERP_MODULES.flatMap((m) => [...m.permissions])),
];

export type RoutePermissionRule = {
  prefix: string;
  permissions: string[];
  requireAll?: string[];
};

/** Longest-prefix wins when resolving route permissions. Sorted longest-first at runtime. */
export const PLATFORM_PORTAL_PERMISSIONS = [...MODULE_PERMISSIONS.platform] as const;

export const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  {
    prefix: '/admin/administration/license',
    permissions: ['license:read', 'license:activate', 'tenant:manage', 'users:manage'],
  },
  { prefix: '/admin/administration', permissions: [...MODULE_PERMISSIONS.administration] },
  { prefix: '/platform/licenses', permissions: [...MODULE_PERMISSIONS.platform] },
  { prefix: '/platform/license-keys', permissions: [...MODULE_PERMISSIONS.platform] },
  { prefix: '/platform', permissions: [...MODULE_PERMISSIONS.platform] },
  { prefix: '/admin/governance', permissions: [...MODULE_PERMISSIONS.governance] },
  { prefix: '/admin/naac', permissions: [...MODULE_PERMISSIONS.naacIqac] },
  { prefix: '/admin/front-office', permissions: [...MODULE_PERMISSIONS.frontOffice] },
  { prefix: '/admin/library', permissions: [...MODULE_PERMISSIONS.library] },
  { prefix: '/admin/hr', permissions: [...MODULE_PERMISSIONS.hr] },
  { prefix: '/admin/fees', permissions: [...MODULE_PERMISSIONS.finance] },
  { prefix: '/admin/transport', permissions: [...MODULE_PERMISSIONS.transport] },
  { prefix: '/admin/inventory', permissions: [...MODULE_PERMISSIONS.inventory] },
  { prefix: '/admin/communication', permissions: [...MODULE_PERMISSIONS.communication] },
  { prefix: '/admin/certificates', permissions: [...MODULE_PERMISSIONS.certificates] },
  { prefix: '/admin/admissions', permissions: [...MODULE_PERMISSIONS.admissions] },
  {
    prefix: '/admin/students',
    permissions: [...MODULE_PERMISSIONS.students, 'communication:read'],
  },
  { prefix: '/admin/id-cards', permissions: [...MODULE_PERMISSIONS.students, 'staff:read'] },
  { prefix: '/admin/staff/attendance', permissions: [...MODULE_PERMISSIONS.staffAttendance] },
  { prefix: '/admin/staff', permissions: [...MODULE_PERMISSIONS.staff] },
  { prefix: '/admin/academics/timetable', permissions: [...MODULE_PERMISSIONS.timetable] },
  {
    prefix: '/admin/academics/teaching-allocation',
    permissions: [...MODULE_PERMISSIONS.timetable],
  },
  {
    prefix: '/admin/academics/teaching-subject-groups',
    permissions: [...MODULE_PERMISSIONS.timetable],
  },
  { prefix: '/admin/academics/lms', permissions: [...MODULE_PERMISSIONS.lms] },
  { prefix: '/admin/academics/question-bank', permissions: [...MODULE_PERMISSIONS.questionBank] },
  { prefix: '/admin/academics/attendance', permissions: [...MODULE_PERMISSIONS.studentAttendance] },
  { prefix: '/admin/academics/examinations', permissions: [...MODULE_PERMISSIONS.examinations] },
  { prefix: '/admin/academic-engine', permissions: [...MODULE_PERMISSIONS.academics] },
  { prefix: '/admin/academic-lifecycle', permissions: [...MODULE_PERMISSIONS.academics] },
  { prefix: '/admin/programs', permissions: [...MODULE_PERMISSIONS.academics] },
  {
    prefix: '/admin/shifts',
    permissions: [...MODULE_PERMISSIONS.shifts, ...MODULE_PERMISSIONS.academics],
  },
  {
    prefix: '/admin/organization/infrastructure',
    permissions: [...MODULE_PERMISSIONS.infrastructure],
  },
  { prefix: '/admin/organization', permissions: [...MODULE_PERMISSIONS.settings] },
  { prefix: '/admin/reports', permissions: [...MODULE_PERMISSIONS.reports] },
  { prefix: '/admin', permissions: [...ALL_ADMIN_MODULE_PERMISSIONS] },
];

export type WorkspaceTemplate = {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  defaultHome: string;
};

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    slug: 'front-office-desk',
    name: 'Front Office Staff',
    description: 'Visitor management, enquiries, gate pass, kiosk, complaints',
    permissions: [
      'front-office:read',
      'front-office:desk',
      'front-office:reports',
      'notifications:read',
    ],
    defaultHome: '/admin/front-office',
  },
  {
    slug: 'librarian',
    name: 'Library Staff',
    description: 'Catalogue, circulation, access desk, reports',
    permissions: [
      'library:read',
      'library:manage',
      'library:circulate',
      'library:reports',
      'library:access-desk',
      'library:digital:read',
      'library:digital:download',
      'library:digital:manage',
      'library:research:read',
      'library:research:submit',
      'library:research:manage',
      'notifications:read',
    ],
    defaultHome: '/admin/library',
  },
  {
    slug: 'accountant',
    name: 'Accounts Staff',
    description: 'Fee collection, receipts, finance reports',
    permissions: ['fees:read', 'fees:manage', 'reports:read', 'notifications:read'],
    defaultHome: '/admin/fees',
  },
  {
    slug: 'transport-coordinator',
    name: 'Transport Manager',
    description: 'Routes, vehicles, student assignments',
    permissions: ['transport:read', 'transport:manage', 'transport:assign', 'notifications:read'],
    defaultHome: '/admin/transport',
  },
  {
    slug: 'store-keeper',
    name: 'Store Keeper',
    description: 'Inventory stores, items, issue and return',
    permissions: ['inventory:read', 'inventory:manage', 'inventory:issue', 'notifications:read'],
    defaultHome: '/admin/inventory',
  },
  {
    slug: 'examination-cell',
    name: 'Examination Cell',
    description: 'Examination sessions, results, reports',
    permissions: [
      'exam:view',
      'exam:create',
      'exam:edit',
      'exam:admin',
      'exam:results',
      'question-bank:read',
      'question-bank:manage',
      'reports:read',
      'notifications:read',
    ],
    defaultHome: '/admin/academics/examinations',
  },
  {
    slug: 'admission-admin',
    name: 'Admission Workspace',
    description: 'Admissions desk and student onboarding',
    permissions: [
      'admissions:read',
      'admissions:manage',
      'students:read',
      'students:manage',
      'students:import',
      'notifications:read',
    ],
    defaultHome: '/admin/admissions',
  },
  {
    slug: 'hod',
    name: 'HOD Workspace',
    description: 'Department-scoped students, academics, attendance, reports',
    permissions: [
      'academic:read',
      'students:read',
      'students:manage-academic',
      'academic-engine:read',
      'reports:read',
      'staff:read',
      'staff:assign-subjects',
      'staff-attendance:view',
      'certificates:read',
      'certificates:approve',
      'question-bank:read',
      'question-bank:approve',
      'lms:read',
      'lms:workspace:manage',
      'lms:materials:upload',
      'lms:assignments:manage',
      'notifications:read',
    ],
    defaultHome: '/admin',
  },
  {
    slug: 'faculty',
    name: 'Faculty Workspace',
    description: 'Teaching, LMS, attendance entry',
    permissions: [
      'academic:read',
      'students:read',
      'reports:read',
      'staff:portal:self',
      'notifications:read',
      'lms:read',
      'lms:materials:upload',
      'lms:assignments:manage',
      'question-bank:contribute',
      'question-bank:read',
    ],
    defaultHome: '/staff/dashboard',
  },
  {
    slug: 'principal',
    name: 'Principal Workspace',
    description: 'Broad read access and institutional reports',
    permissions: [
      'students:read',
      'staff:read',
      'academic:read',
      'fees:read',
      'reports:read',
      'admissions:read',
      'exam:view',
      'certificates:read',
      'notifications:read',
    ],
    defaultHome: '/principal-desk',
  },
  {
    slug: 'vice-principal',
    name: 'Vice Principal Workspace',
    description: 'Principal command center and institutional oversight',
    permissions: [
      'students:read',
      'staff:read',
      'academic:read',
      'fees:read',
      'reports:read',
      'admissions:read',
      'exam:view',
      'certificates:read',
      'notifications:read',
    ],
    defaultHome: '/principal-desk',
  },
];

export const DASHBOARD_WIDGET_PERMISSIONS: Record<string, string[]> = {
  'department-admissions': [...MODULE_PERMISSIONS.admissions],
  'fee-collection-trend': [...MODULE_PERMISSIONS.finance],
  'shift-attendance': [
    ...MODULE_PERMISSIONS.staffAttendance,
    ...MODULE_PERMISSIONS.studentAttendance,
  ],
  'shift-enrollment': [...MODULE_PERMISSIONS.students, ...MODULE_PERMISSIONS.academics],
  'registration-completion': [...MODULE_PERMISSIONS.students, ...MODULE_PERMISSIONS.academics],
  'section-utilization': [...MODULE_PERMISSIONS.academics],
  'pending-approvals': [...MODULE_PERMISSIONS.administration, ...MODULE_PERMISSIONS.certificates],
  'front-office-summary': [...MODULE_PERMISSIONS.frontOffice],
  'library-summary': [...MODULE_PERMISSIONS.library],
  'license-status': ['license:read', 'license:activate', 'tenant:manage', 'users:manage'],
};

export function isSuperAdmin(roles: string[]): boolean {
  return roles.some((r) => (SUPER_ADMIN_ROLES as readonly string[]).includes(r));
}

export function hasAnyListedPermission(
  permissions: string[],
  roles: string[],
  required: string[],
): boolean {
  if (!required.length) return true;
  if (isSuperAdmin(roles)) return true;
  return required.some((p) => permissions.includes(p));
}

export function hasAllListedPermissions(
  permissions: string[],
  roles: string[],
  required: string[],
): boolean {
  if (!required.length) return true;
  if (isSuperAdmin(roles)) return true;
  return required.every((p) => permissions.includes(p));
}

export function canAccessPlatformPortal(roles: string[], permissions: string[] = []): boolean {
  if (roles.includes('platform-admin')) return true;
  return hasAnyListedPermission(permissions, roles, [...PLATFORM_PORTAL_PERMISSIONS]);
}

export function canAccessAdminPortal(roles: string[], permissions: string[] = []): boolean {
  if (isSuperAdmin(roles)) return true;
  if (
    roles.some((r) =>
      [
        'institution-admin',
        'academic-admin',
        'admission-admin',
        'hod',
        'accountant',
        'librarian',
        'shift-admin',
        'shift-academic-coordinator',
        'shift-attendance-manager',
        'shift-examination-coordinator',
        'front-office-desk',
        'transport-coordinator',
        'store-keeper',
        'examination-cell',
        'registrar',
        'principal',
        'vice-principal',
        'erp-administrator',
        'hostel-warden',
      ].includes(r),
    )
  ) {
    return true;
  }
  return hasAnyListedPermission(permissions, roles, ALL_ADMIN_MODULE_PERMISSIONS);
}

export function resolveDefaultAdminHome(permissions: string[], roles: string[]): string {
  if (isSuperAdmin(roles)) return '/admin';

  for (const template of WORKSPACE_TEMPLATES) {
    if (roles.includes(template.slug)) return template.defaultHome;
  }

  const moduleHomes: { count: number; home: string }[] = [];
  for (const mod of ERP_MODULES) {
    if (mod.id === 'dashboard') continue;
    const matchCount = mod.permissions.filter((p) => permissions.includes(p)).length;
    if (matchCount > 0) moduleHomes.push({ count: matchCount, home: mod.defaultHome });
  }

  if (moduleHomes.length === 1) return moduleHomes[0]!.home;

  if (moduleHomes.length > 1) {
    moduleHomes.sort((a, b) => b.count - a.count);
    return moduleHomes[0]!.home;
  }

  return '/admin';
}

const SORTED_ROUTE_RULES = [...ROUTE_PERMISSION_RULES].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

export function resolveRoutePermissionRule(pathname: string): RoutePermissionRule | null {
  if (!pathname.startsWith('/admin')) return null;
  for (const rule of SORTED_ROUTE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule;
    }
  }
  return null;
}

export function canAccessAdminRoute(
  pathname: string,
  permissions: string[],
  roles: string[],
): boolean {
  if (!canAccessAdminPortal(roles, permissions)) return false;
  const rule = resolveRoutePermissionRule(pathname);
  if (!rule) return isSuperAdmin(roles);
  if (rule.requireAll?.length) {
    return hasAllListedPermissions(permissions, roles, rule.requireAll);
  }
  return hasAnyListedPermission(permissions, roles, rule.permissions);
}

export function getAccessibleModules(permissions: string[], roles: string[]): ErpModule[] {
  if (isSuperAdmin(roles)) return ERP_MODULES;
  return ERP_MODULES.filter((m) => hasAnyListedPermission(permissions, roles, [...m.permissions]));
}
