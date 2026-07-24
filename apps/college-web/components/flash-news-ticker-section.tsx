import 'server-only';

import { FlashNewsTicker } from '@/components/flash-news-ticker';
import { getFlashAnnouncements } from '@/lib/flash-announcements';
import '@/app/flash-news-ticker.css';

/** Server wrapper so the ticker can soft-fail without blocking the homepage. */
export async function FlashNewsTickerSection() {
  try {
    const items = await getFlashAnnouncements(12);
    if (!items.length) return null;
    return <FlashNewsTicker items={items} label="Announcements" />;
  } catch {
    return null;
  }
}
