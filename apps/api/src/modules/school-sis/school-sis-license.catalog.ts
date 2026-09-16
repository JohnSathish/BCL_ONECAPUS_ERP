export const SCHOOL_LICENSE_MODULES = [
  { id: 'academic', label: 'Academic' },
  { id: 'students', label: 'Students' },
  { id: 'staff', label: 'Staff' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fees' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'examination', label: 'Examination' },
  { id: 'library', label: 'Library' },
  { id: 'transport', label: 'Transport' },
  { id: 'hr_payroll', label: 'HR & Payroll' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'automation', label: 'Automation' },
  { id: 'mobile', label: 'Mobile App' },
  { id: 'android', label: 'Android App' },
  { id: 'ios', label: 'iOS App' },
] as const;

export type SchoolLicenseModuleId =
  (typeof SCHOOL_LICENSE_MODULES)[number]['id'];

export const SCHOOL_LICENSE_TYPES = [
  'TRIAL',
  'ANNUAL',
  'MULTI_YEAR',
  'LIFETIME',
  'ENTERPRISE',
  'CUSTOM',
] as const;

export type SchoolLicenseType = (typeof SCHOOL_LICENSE_TYPES)[number];

export const NAV_MODULE_LICENSE: Record<string, SchoolLicenseModuleId> = {
  'academic-config': 'academic',
  students: 'students',
  teachers: 'staff',
  staff: 'staff',
  attendance: 'attendance',
  fees: 'fees',
  accounts: 'accounts',
  billing: 'fees',
  examination: 'examination',
  library: 'library',
  transport: 'transport',
  'hr-payroll': 'hr_payroll',
  sms: 'sms',
  whatsapp: 'whatsapp',
  notifications: 'notifications',
  automation: 'automation',
  'reports-analytics': 'reports',
  'mobile-app': 'mobile',
};

export function allSchoolLicenseModuleIds(): string[] {
  return SCHOOL_LICENSE_MODULES.map((m) => m.id);
}
