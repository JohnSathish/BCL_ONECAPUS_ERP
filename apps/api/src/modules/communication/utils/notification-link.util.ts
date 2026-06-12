import {
  resolveHomePath,
  sanitizeNotificationLink,
} from '../../../common/permissions/portal-access';

type RecipientType =
  | 'STUDENT'
  | 'STAFF'
  | 'PARENT'
  | 'FACULTY'
  | 'ADMIN'
  | string;

/** Resolve in-app notification destination from trigger context and audience. */
export function resolveNotificationLink(input: {
  recipientType: RecipientType;
  triggerKey?: string;
  entityType?: string;
  roles?: string[];
}): string | undefined {
  const trigger = (input.triggerKey ?? '').toLowerCase();
  const type = String(input.recipientType ?? '').toUpperCase();

  if (type === 'STUDENT' || input.roles?.includes('student')) {
    if (trigger.includes('certificate')) return '/student/certificates';
    if (trigger.includes('fee') || trigger.includes('due'))
      return '/student/fees';
    if (trigger.includes('timetable')) return '/student/timetable';
    if (trigger.includes('exam') || trigger.includes('result'))
      return '/student/results';
    if (trigger.includes('admission')) return '/student';
    if (trigger.includes('lms')) return '/student/lms';
    if (trigger.includes('question-bank') || trigger.includes('question_bank'))
      return '/student/question-bank';
    if (trigger.includes('library')) return '/student/library';
    if (trigger.includes('transport')) return '/student';
    return '/student';
  }

  if (
    type === 'STAFF' ||
    type === 'FACULTY' ||
    input.roles?.some((r) => r === 'faculty' || r === 'staff')
  ) {
    if (trigger.includes('timetable')) return '/staff/academic/timetable';
    if (trigger.includes('lms')) return '/staff/academic/lms';
    return '/staff/dashboard';
  }

  if (type === 'PARENT' || input.roles?.includes('parent')) {
    return '/parent';
  }

  if (trigger.includes('admission')) return '/admin/admissions';
  if (trigger.includes('transport')) return '/admin/transport/alerts';
  if (trigger.includes('communication') || trigger.includes('campaign'))
    return '/admin/communication';

  // Manual admin campaigns — no default deep link; admins can open Communication from nav.
  if (input.roles?.length) {
    return resolveHomePath(input.roles);
  }

  return undefined;
}

export function finalizeNotificationLink(
  roles: string[],
  proposed?: string | null,
  fallback?: string,
) {
  const candidate = proposed ?? fallback;
  if (!candidate) return undefined;
  return sanitizeNotificationLink(roles, candidate);
}
