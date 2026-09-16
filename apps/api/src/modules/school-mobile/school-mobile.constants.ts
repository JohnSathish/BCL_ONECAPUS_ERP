export const SCHOOL_MOBILE_PERMISSION_STUDENT = 'school-mobile:student';
export const SCHOOL_MOBILE_PERMISSION_PARENT = 'school-mobile:parent';
export const SCHOOL_MOBILE_PERMISSION_STAFF = 'school-mobile:staff';
export const SCHOOL_MOBILE_PERMISSION_MANAGE = 'school-mobile:manage';

export const SCHOOL_MOBILE_ACCESS_PERMISSIONS = [
  SCHOOL_MOBILE_PERMISSION_STUDENT,
  SCHOOL_MOBILE_PERMISSION_PARENT,
  SCHOOL_MOBILE_PERMISSION_STAFF,
  SCHOOL_MOBILE_PERMISSION_MANAGE,
] as const;

export const SCHOOL_MOBILE_ANDROID_CHANNEL = 'stlukes_school_default';
export const SCHOOL_MOBILE_APP_NAME = "St. Luke's School";
export const SCHOOL_MOBILE_LOGIN_HOST = 'erp.stlukestura.in';
export const SCHOOL_MOBILE_TENANT_SLUG = 'st-lukes-tura';
/** First-login password for St. Luke's students (they must change it after sign-in). */
export const SCHOOL_MOBILE_DEFAULT_PASSWORD = 'StLuke@123';

export const SCHOOL_MOBILE_PERSONAS = [
  'student',
  'parent',
  'teacher',
  'admin',
  'accountant',
  'librarian',
  'transport',
] as const;

export type SchoolMobilePersona = (typeof SCHOOL_MOBILE_PERSONAS)[number];

export const SCHOOL_MOBILE_AUDIENCES = [
  'all',
  'students',
  'parents',
  'teachers',
  'admins',
  'class',
  'section',
  'user',
] as const;

export type SchoolMobileAudience = (typeof SCHOOL_MOBILE_AUDIENCES)[number];
