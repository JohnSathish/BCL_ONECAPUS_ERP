import type { Href } from 'expo-router';

/**
 * Map server notification links (web portal paths or custom scheme) to Expo Router hrefs.
 */
export function resolveMobileDeepLink(link?: string | null): Href | null {
  if (!link?.trim()) return null;
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

  const lower = path.toLowerCase();

  // Student
  if (lower.includes('/student/fees') || lower.includes('fee')) {
    return '/(student)/(tabs)/fees' as Href;
  }
  if (
    lower.includes('/student/attendance') ||
    (lower.includes('attendance') && !lower.includes('staff'))
  ) {
    return '/(student)/attendance' as Href;
  }
  if (lower.includes('/student/results') || lower.includes('result') || lower.includes('exam')) {
    return '/(student)/results' as Href;
  }
  if (lower.includes('/student/timetable') || lower.includes('timetable')) {
    if (lower.includes('/staff')) return '/(staff)/timetable' as Href;
    return '/(student)/timetable' as Href;
  }
  if (lower.includes('/student/library') || lower.includes('library')) {
    return '/(student)/library' as Href;
  }
  if (lower.includes('/student/assignments') || lower.includes('assignment')) {
    return '/(student)/assignments' as Href;
  }
  if (lower.includes('/student/leave')) {
    return '/(student)/leave' as Href;
  }
  if (lower.includes('/student/certificates')) {
    return '/(student)/(tabs)' as Href;
  }
  if (lower.includes('/student') && !lower.includes('/staff')) {
    return '/(student)/(tabs)/notifications' as Href;
  }

  // Staff / faculty
  if (lower.includes('mark') || lower.includes('/marks')) {
    return '/(staff)/marks' as Href;
  }
  if (lower.includes('leave')) {
    return '/(staff)/leave' as Href;
  }
  if (lower.includes('payroll') || lower.includes('payslip')) {
    return '/(staff)/payroll' as Href;
  }
  if (lower.includes('/staff') || lower.includes('faculty')) {
    return '/(staff)/notifications' as Href;
  }

  return null;
}

export function fallbackNotificationCenter(appType: 'student' | 'staff'): Href {
  return appType === 'staff'
    ? ('/(staff)/notifications' as Href)
    : ('/(student)/(tabs)/notifications' as Href);
}
