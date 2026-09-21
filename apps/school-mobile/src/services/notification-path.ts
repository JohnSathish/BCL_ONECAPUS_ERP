export const HOME_PATH = '/home';
export const MESSAGES_PATH = '/messages';

export function isHomePath(href: string) {
  return (
    href === '/home' ||
    href === '/(tabs)/home' ||
    href === '/(tabs)/index' ||
    href === '/(tabs)' ||
    href === '/(tabs)/'
  );
}

function isInboxLink(href: string) {
  return href === '/inbox' || href === '/messages' || href === '/(tabs)/messages';
}

export function resolveAppHref(href?: string | null, fallback: string = HOME_PATH) {
  const dest = href || fallback;
  return isHomePath(dest) ? HOME_PATH : dest;
}

export function notificationPath(data?: Record<string, unknown> | null) {
  const attach = String(data?.attachmentUrl || data?.imageUrl || '').trim();
  const kind = String(data?.attachmentType || '').toLowerCase();
  const pdf = kind === 'pdf' || attach.toLowerCase().includes('.pdf');
  if (pdf && /^https?:\/\//i.test(attach)) {
    return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
  }
  const rawLink = String(data?.deepLink || '').trim();
  if (/^https?:\/\//i.test(rawLink)) return rawLink;
  if (rawLink.startsWith('/')) {
    if (isInboxLink(rawLink)) return MESSAGES_PATH;
    if (isHomePath(rawLink)) return HOME_PATH;
    return rawLink;
  }
  if (rawLink.startsWith('notification://')) {
    const parts = rawLink.replace('notification://', '').split('/').filter(Boolean);
    const rest = parts[0]?.toLowerCase();
    const related = parts[1] || '';
    if (rest === 'document' && /^https?:\/\//i.test(attach)) {
      return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
    }
    if (rest === 'homework' && related) {
      return `/homework?id=${encodeURIComponent(related)}`;
    }
    return mapType(rest);
  }
  const type = String(data?.type || data?.category || '').toLowerCase();
  const related = String(data?.relatedId || data?.entityId || '');
  if (type === 'notice' && related) return `/notice/${related}`;
  if (type === 'event' && related) return `/event/${related}`;
  if (type === 'gallery' && related) return `/gallery/${related}`;
  if ((type === 'homework' || type === 'HOMEWORK'.toLowerCase()) && related) {
    return `/homework?id=${encodeURIComponent(related)}`;
  }
  if (type === 'document' && /^https?:\/\//i.test(attach)) {
    return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
  }
  const mapped = mapType(type);
  if (mapped !== MESSAGES_PATH) return mapped;
  const screen = String(data?.screen || data?.path || '').trim();
  if (screen.startsWith('/') && !isHomePath(screen) && !/^https?:\/\//i.test(screen)) {
    return isInboxLink(screen) ? MESSAGES_PATH : screen;
  }
  return MESSAGES_PATH;
}

function mapType(type?: string) {
  switch (type) {
    case 'fees':
    case 'fee':
      return '/fees';
    case 'attendance':
      return '/attendance';
    case 'homework':
      return '/homework';
    case 'holiday':
    case 'academic_calendar':
      return '/calendar';
    case 'notices':
      return '/(tabs)/notices';
    case 'event':
      return '/(tabs)/events';
    case 'examination':
    case 'result':
    case 'exam':
      return '/examinations';
    case 'transport':
      return '/transport';
    case 'student':
      return '/profile';
    case 'document':
      return MESSAGES_PATH;
    case 'announcement':
    case 'dashboard':
    case 'general':
    case 'system':
    case 'library':
    case 'none':
    case '':
    default:
      return MESSAGES_PATH;
  }
}
