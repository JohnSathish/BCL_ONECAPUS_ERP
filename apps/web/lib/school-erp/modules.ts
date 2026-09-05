/**
 * School ERP module registry — single source of truth for which product
 * areas are active vs Coming Soon.
 *
 * Today only Admission is active. When Students / Attendance / Fees go live,
 * flip their status to `active` and register a dashboard overview widget;
 * the home page will compose a multi-module overview automatically.
 */

export type SchoolErpModuleStatus = 'active' | 'coming_soon';

export type SchoolErpProductModuleId =
  | 'admission'
  | 'students'
  | 'academics'
  | 'attendance'
  | 'examinations'
  | 'fees'
  | 'staff'
  | 'hr'
  | 'timetable'
  | 'library'
  | 'transport'
  | 'inventory'
  | 'communications'
  | 'reports';

export type SchoolErpProductModule = {
  id: SchoolErpProductModuleId;
  label: string;
  /** Sidebar nav module id in SCHOOL_ERP_NAV (when mapped 1:1). */
  navModuleId?: string;
  status: SchoolErpModuleStatus;
  description?: string;
  /** Dashboard overview slot — only rendered when status === 'active'. */
  dashboardWidget?: 'admission' | 'students' | 'attendance' | 'academics' | 'fees' | 'staff';
};

/**
 * Enable / disable modules here. Do not scatter feature flags across pages.
 */
export const SCHOOL_ERP_MODULES: SchoolErpProductModule[] = [
  {
    id: 'admission',
    label: 'K.G. Admission 2027',
    navModuleId: 'admission-2027',
    status: 'active',
    description: 'Online K.G. applications, payments, documents, and decisions',
    dashboardWidget: 'admission',
  },
  {
    id: 'students',
    label: 'Student Management',
    navModuleId: 'academics',
    status: 'coming_soon',
    dashboardWidget: 'students',
  },
  {
    id: 'academics',
    label: 'Academics',
    navModuleId: 'academics',
    status: 'coming_soon',
    dashboardWidget: 'academics',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    status: 'coming_soon',
    dashboardWidget: 'attendance',
  },
  {
    id: 'examinations',
    label: 'Examinations',
    status: 'coming_soon',
  },
  {
    id: 'fees',
    label: 'Fees & Finance',
    status: 'coming_soon',
    dashboardWidget: 'fees',
  },
  {
    id: 'staff',
    label: 'Staff & Faculty',
    navModuleId: 'school-management',
    status: 'coming_soon',
    dashboardWidget: 'staff',
  },
  {
    id: 'hr',
    label: 'Human Resources',
    status: 'coming_soon',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    status: 'coming_soon',
  },
  {
    id: 'library',
    label: 'Library',
    status: 'coming_soon',
  },
  {
    id: 'transport',
    label: 'Transport',
    status: 'coming_soon',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    status: 'coming_soon',
  },
  {
    id: 'communications',
    label: 'Communications',
    status: 'coming_soon',
  },
  {
    id: 'reports',
    label: 'Reports',
    navModuleId: 'reports',
    status: 'coming_soon',
  },
];

export function getSchoolErpModule(id: SchoolErpProductModuleId) {
  return SCHOOL_ERP_MODULES.find((m) => m.id === id);
}

export function isSchoolErpModuleActive(id: SchoolErpProductModuleId): boolean {
  return getSchoolErpModule(id)?.status === 'active';
}

export function getActiveSchoolErpModules(): SchoolErpProductModule[] {
  return SCHOOL_ERP_MODULES.filter((m) => m.status === 'active');
}

/** True when more than one product module is live → combined ERP overview mode. */
export function isSchoolErpMultiModuleDashboard(): boolean {
  return getActiveSchoolErpModules().length > 1;
}

export function getActiveDashboardWidgetIds(): NonNullable<
  SchoolErpProductModule['dashboardWidget']
>[] {
  return getActiveSchoolErpModules()
    .map((m) => m.dashboardWidget)
    .filter((id): id is NonNullable<SchoolErpProductModule['dashboardWidget']> => Boolean(id));
}
