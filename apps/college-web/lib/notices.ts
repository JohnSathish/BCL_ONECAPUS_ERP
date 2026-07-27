import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { isDemoWebsiteContentSlug } from '@/lib/demo-content-slugs';
import type { HubNotice, HubNoticeBadge } from '@/lib/information-hub';

function badgeFromNotice(
  priority: string,
  category: string,
  hasAttachment: boolean,
): HubNoticeBadge | 'URGENT' {
  if (priority === 'URGENT') return 'URGENT';
  if (priority === 'IMPORTANT') return 'IMPORTANT';
  if (hasAttachment) return 'PDF';
  const map: Record<string, HubNoticeBadge> = {
    HOLIDAY: 'HOLIDAY',
    CIRCULAR: 'CIRCULAR',
    SCHOLARSHIP: 'SCHOLARSHIP',
    TENDER: 'TENDER',
    EXAMINATION: 'EXAM',
  };
  return map[category] ?? 'NEW';
}

export async function getPublicNotices(): Promise<HubNotice[]> {
  const rows = await fetchCms('notices', {}, 120);
  if (!Array.isArray(rows) || !rows.length) return [];
  const notices: HubNotice[] = [];
  for (const row of rows) {
    if (!isRecord(row) || typeof row.title !== 'string' || typeof row.id !== 'string') continue;
    const slug = typeof row.slug === 'string' ? row.slug : '';
    if (isDemoWebsiteContentSlug(slug)) continue;
    const attachmentUrl = typeof row.attachmentUrl === 'string' ? row.attachmentUrl : undefined;
    const priority = typeof row.priority === 'string' ? row.priority : 'NORMAL';
    const category = typeof row.category === 'string' ? row.category : 'GENERAL';
    const publishedAt =
      typeof row.publishAt === 'string'
        ? row.publishAt
        : typeof row.createdAt === 'string'
          ? row.createdAt
          : new Date().toISOString();
    notices.push({
      id: row.id,
      title: row.title,
      badge: badgeFromNotice(priority, category, Boolean(attachmentUrl)),
      publishedAt: publishedAt.slice(0, 10),
      href: `/notices/${typeof row.slug === 'string' ? row.slug : row.id}`,
      attachmentHref: attachmentUrl,
      urgent: priority === 'URGENT',
    });
  }
  return notices;
}
