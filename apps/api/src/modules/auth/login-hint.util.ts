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
