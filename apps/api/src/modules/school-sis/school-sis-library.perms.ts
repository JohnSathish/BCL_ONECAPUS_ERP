export const SIS_LIB_VIEW = [
  'school-sis:manage',
  'library.view',
  'library.issue',
  'library.manage',
] as const;
export const SIS_LIB_ISSUE = [
  'school-sis:manage',
  'library.issue',
  'library.manage',
] as const;
export const SIS_LIB_RETURN = [
  'school-sis:manage',
  'library.return',
  'library.manage',
] as const;
export const SIS_LIB_MANAGE = ['school-sis:manage', 'library.manage'] as const;
export const SIS_LIB_FINES = [
  'school-sis:manage',
  'library.fines',
  'library.manage',
  'accounts.create',
] as const;
export const SIS_LIB_SELF = [
  'school-sis:read',
  'school-mobile:student',
  'school-mobile:staff',
  'school-mobile:parent',
  'library.view',
  'library.issue',
] as const;
