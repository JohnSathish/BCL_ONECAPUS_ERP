import 'server-only';

import { listPublicAnnouncements } from '@/lib/announcements';

export type FlashAnnouncement = {
  id: string;
  title: string;
  href?: string;
  isNew?: boolean;
};

/**
 * Homepage Announcements ticker — Website CMS Announcements only
 * (items with Show on ticker). Never mix in News, Flash News CPT, notices, or seeds.
 */
export async function getFlashAnnouncements(limit = 12): Promise<FlashAnnouncement[]> {
  const announcements = await listPublicAnnouncements({ ticker: true }).catch(() => []);

  return announcements.slice(0, limit).map((item) => ({
    id: `announcement-${item.id}`,
    title: item.title,
    href: item.href,
    isNew: item.isNew || item.isPinned,
  }));
}
