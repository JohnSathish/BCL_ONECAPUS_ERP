export function notificationPath(data?: Record<string, unknown> | null) {
  const attach = String(data?.attachmentUrl || data?.imageUrl || data?.path || '').trim();
  const kind = String(data?.attachmentType || '').toLowerCase();
  const pdf = kind === 'pdf' || attach.toLowerCase().includes('.pdf');
  if (pdf && /^https?:\/\//i.test(attach)) {
    return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
  }
  if (attach && /^https?:\/\//i.test(attach) && /\.(png|jpe?g|webp|gif)($|\?)/i.test(attach)) {
    return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Photo')}`;
  }
  const rawLink = String(data?.deepLink || data?.path || '').trim();
  if (/^https?:\/\//i.test(rawLink)) return rawLink;
  if (rawLink.startsWith('/')) return rawLink;
  if (rawLink.startsWith('notification://')) {
    const rest = rawLink.replace('notification://', '').split('/')[0]?.toLowerCase();
    if (rest === 'document' && /^https?:\/\//i.test(attach)) {
      return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
    }
    return mapType(rest);
  }
  const type = String(data?.type || data?.category || '').toLowerCase();
  const related = String(data?.relatedId || data?.entityId || '');
  if (type === 'notice' && related) return `/notice/${related}`;
  if (type === 'event' && related) return `/event/${related}`;
  if (type === 'gallery' && related) return `/gallery/${related}`;
  if (type === 'document' && /^https?:\/\//i.test(attach)) {
    return `/media-view?url=${encodeURIComponent(attach)}&title=${encodeURIComponent('Document')}`;
  }
  return mapType(type);
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
    case 'announcement':
      return '/(tabs)/notices';
    case 'event':
      return '/(tabs)/events';
    case 'dashboard':
    case 'general':
    case 'system':
      return '/(tabs)';
    case 'examination':
    case 'result':
    case 'exam':
      return '/examinations';
    case 'transport':
      return '/transport';
    case 'library':
      return '/';
    case 'student':
      return '/profile';
    case 'document':
      return '/inbox';
    default:
      return '/inbox';
  }
}
