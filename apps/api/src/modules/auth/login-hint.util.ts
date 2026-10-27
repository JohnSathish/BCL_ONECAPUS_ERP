import {
  ADMIN_PORTAL_ROLES,
  STAFF_PORTAL_ROLES,
  STUDENT_PORTAL_ROLES,
} from '../../common/permissions/portal-access';

export type LoginHintKind = 'student' | 'faculty' | 'staff' | 'admin';

export type LoginHintPayload = {
  kind: LoginHintKind;
  label: string;
  icon: string;
  tone: string;
};

export function resolveLoginHintFromRoles(
  roleCodes: string[],
): LoginHintPayload | null {
  const roles = roleCodes.map((code) => code.toLowerCase()).filter(Boolean);
  if (!roles.length) return null;

  const isStudent = roles.some((r) => STUDENT_PORTAL_ROLES.has(r));
  const isFaculty = roles.includes('faculty');
  const isStaff = roles.some((r) => STAFF_PORTAL_ROLES.has(r));
  const isAdmin = roles.some(
    (r) => ADMIN_PORTAL_ROLES.has(r) || r === 'platform-admin',
  );

  if (isAdmin) {
    return {
      kind: 'admin',
      label: 'Admin Account',
      icon: '🏛',
      tone: '#be185d',
    };
  }
  if (isFaculty) {
    return {
      kind: 'faculty',
      label: 'Faculty Account',
      icon: '👩‍🏫',
      tone: '#0d9488',
    };
  }
  if (isStaff) {
    return {
      kind: 'staff',
      label: 'Staff Account',
      icon: '👔',
      tone: '#0d9488',
    };
  }
  if (isStudent) {
    return {
      kind: 'student',
      label: 'Student Account',
      icon: '👨‍🎓',
      tone: '#2563eb',
    };
  }

  return {
    kind: 'admin',
    label: 'College Account',
    icon: '🔐',
    tone: '#1e40af',
  };
}

/** Local-part segment after the first name, e.g. tusumika.sociology@… */
const FACULTY_DEPARTMENT_TOKENS = new Set([
  'botany',
  'chemistry',
  'commerce',
  'computer-science',
  'computerscience',
  'cs',
  'economics',
  'education',
  'english',
  'garo',
  'geography',
  'history',
  'mathematics',
  'maths',
  'philosophy',
  'physics',
  'political-science',
  'politicalscience',
  'polsc',
  'sociology',
  'zoology',
  'eco',
  'edn',
  'edu',
  'eng',
  'gar',
  'geo',
  'his',
  'phi',
  'pol',
  'soc',
  'bot',
  'che',
  'mth',
  'phy',
  'zoo',
  'com',
]);

export function facultyDepartmentEmailHint(
  raw: string,
): LoginHintPayload | null {
  const email = raw.trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const dot = local.indexOf('.');
  if (dot <= 0) return null;
  const department = local.slice(dot + 1);
  if (!FACULTY_DEPARTMENT_TOKENS.has(department)) return null;
  return {
    kind: 'faculty',
    label: 'Faculty Account',
    icon: '👩‍🏫',
    tone: '#0d9488',
  };
}
