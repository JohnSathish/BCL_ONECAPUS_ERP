import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { listPublicAnnouncements } from '@/lib/announcements';
import { getPublicNews } from '@/lib/news';
import { getPublicNotices } from '@/lib/notices';

export type FlashAnnouncement = {
  id: string;
  title: string;
  href?: string;
  isNew?: boolean;
};

function asFields(row: Record<string, unknown>) {
  return {
    ...((isRecord(row.fields) ? row.fields : {}) as Record<string, unknown>),
    ...((isRecord(row.data) ? row.data : {}) as Record<string, unknown>),
  };
}

function isRecent(dateValue: unknown, withinDays = 21) {
  if (typeof dateValue !== 'string' || !dateValue) return false;
  const time = Date.parse(dateValue);
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= withinDays * 24 * 60 * 60 * 1000;
}

function mapContentEntries(rows: unknown[]): FlashAnnouncement[] {
  if (!Array.isArray(rows)) return [];
  const items: FlashAnnouncement[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const fields = asFields(row);
    const title =
      (typeof row.title === 'string' && row.title.trim()) ||
      (typeof fields.summary === 'string' && fields.summary.trim()) ||
      '';
    if (!title) continue;
    const id = typeof row.id === 'string' ? row.id : title;
    const href =
      typeof fields.href === 'string' && fields.href.trim() ? fields.href.trim() : undefined;
    items.push({
      id,
      title,
      href,
      isNew: isRecent(row.publishedAt) || isRecent(row.updatedAt) || isRecent(row.createdAt),
    });
  }
  return items;
}

/**
 * Prefer dedicated WebsiteAnnouncement records for the ticker.
 * Fall back to legacy CPT flash-news, notices, then news.
 */
export async function getFlashAnnouncements(limit = 12): Promise<FlashAnnouncement[]> {
  const [announcements, flash, notices, news] = await Promise.all([
    listPublicAnnouncements({ ticker: true }),
    fetchCms('content/flash-news', {}, 60, 8000),
    getPublicNotices(),
    getPublicNews(),
  ]);

  const fromAnnouncements: FlashAnnouncement[] = announcements.map((item) => ({
    id: `announcement-${item.id}`,
    title: item.title,
    href: item.href,
    isNew: item.isNew || item.isPinned,
  }));

  const fromFlash = mapContentEntries(Array.isArray(flash) ? flash : []);
  const fromNotices: FlashAnnouncement[] = notices.map((notice) => ({
    id: `notice-${notice.id}`,
    title: notice.title,
    href: notice.href,
    isNew: notice.badge === 'NEW' || notice.urgent || isRecent(notice.publishedAt),
  }));
  const fromNews: FlashAnnouncement[] = news.slice(0, 8).map((item) => ({
    id: `news-${item.slug}`,
    title: item.title,
    href: `/news/${item.slug}`,
    isNew: isRecent(item.date),
  }));

  const merged: FlashAnnouncement[] = [];
  const seen = new Set<string>();
  for (const item of [...fromAnnouncements, ...fromFlash, ...fromNotices, ...fromNews]) {
    const key = item.title.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
