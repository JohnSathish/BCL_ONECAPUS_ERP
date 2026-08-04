import type { Href } from 'expo-router';

function normalizePath(link: string): string {
  let path = link.trim();

  if (path.startsWith('onecampus://')) {
    path = path.replace('onecampus://', '/');
  }
  try {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      const url = new URL(path);
      path = url.pathname + url.search;
    }
  } catch {
    // keep raw path
  }

  if (!path.startsWith('/')) path = `/${path}`;
  // strip trailing slash except root
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/**
 * Map server notification links (web portal paths or custom scheme) to Expo Router hrefs.
 */
export function resolveMobileDeepLink(link?: string | null): Href | null {
  if (!link?.trim()) return null;
  const path = normalizePath(link);
  const lower = path.toLowerCase();

  // Exact student home — do not dump users on the Alerts tab
  if (lower === '/student' || lower === '/student/dashboard' || lower === '/student/home') {
    return '/(student)/(tabs)' as Href;
  }

  // Student — specific screens first
  if (
    lower.includes('/student/examination-fees') ||
    lower.includes('/student/exam-fees') ||
    lower.includes('examination-fee')
  ) {
    return '/(student)/examination-fees' as Href;
  }
  if (
    lower.includes('/student/fees') ||
    lower.includes('/student/fee') ||
    /(^|\/)fees?(\/|$)/.test(lower)
  ) {
    return '/(student)/(tabs)/fees' as Href;
  }
  if (
    lower.includes('/student/attendance') ||
    (lower.includes('attendance') && !lower.includes('staff'))
  ) {
    return '/(student)/attendance' as Href;
  }
  if (
    lower.includes('/student/results') ||
    lower.includes('/student/exams') ||
    lower.includes('result')
  ) {
    return '/(student)/results' as Href;
  }
  if (lower.includes('/student/timetable') || lower.includes('timetable')) {
    if (lower.includes('/staff')) return '/(staff)/timetable' as Href;
    return '/(student)/timetable' as Href;
  }
  if (lower.includes('/student/library') || lower.includes('library')) {
    return '/(student)/library' as Href;
  }
  if (lower.includes('/student/campus-competitions') || lower.includes('campus-competition')) {
    return '/(student)/campus-competitions' as Href;
  }
  if (
    lower.includes('/student/assignments') ||
    lower.includes('/student/lms') ||
    lower.includes('assignment')
  ) {
    return '/(student)/assignments' as Href;
  }
  if (lower.includes('/student/leave')) {
    return '/(student)/leave' as Href;
  }
  {
    const chatMatch = lower.match(/\/student\/support\/chats?\/([a-z0-9-]+)/);
    if (chatMatch?.[1]) {
      return `/(student)/support-chat/${chatMatch[1]}` as Href;
    }
    const ticketMatch = lower.match(/\/student\/support\/tickets\/([a-z0-9-]+)/);
    if (ticketMatch?.[1]) {
      return `/(student)/support-ticket/${ticketMatch[1]}` as Href;
    }
    if (lower.includes('/student/support')) {
      return '/(student)/support' as Href;
    }
  }
  if (
    lower.includes('/student/my-profile') ||
    lower.includes('/student/profile') ||
    lower.includes('/student/complete-profile')
  ) {
    return '/(student)/complete-profile' as Href;
  }
  if (lower.includes('/student/notifications') || lower.includes('/student/alerts')) {
    return '/(student)/(tabs)/notifications' as Href;
  }
  if (lower.includes('birthday')) {
    if (lower.includes('/staff')) return '/(staff)/(tabs)' as Href;
    return '/(student)/(tabs)' as Href;
  }
  if (lower.includes('/student/certificates')) {
    return '/(student)/(tabs)' as Href;
  }
  // Remaining /student/* → Home (not Notifications)
  if (lower.startsWith('/student') && !lower.includes('/staff')) {
    return '/(student)/(tabs)' as Href;
  }

  // Principal Desk / Communication Hub — before generic staff leave matching
  if (lower.includes('/principal-desk/communication-hub/messages/')) {
    const match = lower.match(/\/messages\/([a-z0-9-]+)/);
    if (match?.[1]) return `/(principal)/mail/${match[1]}` as Href;
    return '/(principal)/(tabs)/inbox' as Href;
  }
  if (
    lower.includes('/principal-desk/communication-hub') ||
    lower.includes('principal_mail') ||
    lower.includes('principal-mail')
  ) {
    return '/(principal)/(tabs)/inbox' as Href;
  }
  if (lower.includes('/principal-desk/leave')) {
    return '/(principal)/(tabs)/approvals' as Href;
  }
  if (lower.includes('/principal-desk')) {
    return '/(principal)/(tabs)' as Href;
  }

  // Staff / faculty
  if (lower === '/staff' || lower === '/staff/dashboard' || lower === '/faculty') {
    return '/(staff)/(tabs)' as Href;
  }
  if (lower.includes('/staff/notifications') || lower.includes('/staff/alerts')) {
    return '/(staff)/(tabs)/notifications' as Href;
  }
  if (lower.includes('mark') || lower.includes('/marks')) {
    return '/(staff)/marks' as Href;
  }
  if (lower.includes('/staff/leave') || lower.includes('/faculty/leave')) {
    return '/(staff)/leave' as Href;
  }
  if (lower.includes('payroll') || lower.includes('payslip')) {
    return '/(staff)/payroll' as Href;
  }
  if (lower.includes('/staff') || lower.includes('faculty')) {
    return '/(staff)/(tabs)' as Href;
  }

  return null;
}

/** True when the link has no useful in-app destination beyond Home / Alerts. */
export function isGenericNotificationLink(link?: string | null): boolean {
  if (!link?.trim()) return true;
  const lower = normalizePath(link).toLowerCase();
  return (
    lower === '/student' ||
    lower === '/student/dashboard' ||
    lower === '/student/home' ||
    lower === '/staff' ||
    lower === '/staff/dashboard' ||
    lower === '/faculty'
  );
}

export function fallbackNotificationCenter(appType: 'student' | 'staff'): Href {
  return appType === 'staff'
    ? ('/(staff)/(tabs)/notifications' as Href)
    : ('/(student)/(tabs)/notifications' as Href);
}

export function fallbackHome(appType: 'student' | 'staff'): Href {
  return appType === 'staff' ? ('/(staff)/(tabs)' as Href) : ('/(student)/(tabs)' as Href);
}
