import type { Metadata } from 'next';

import {
  DigitalNoticeBoard,
  type NoticeboardPayload,
} from '@/components/noticeboard/digital-notice-board';
import { fetchCms, isRecord, safeTenant } from '@/lib/cms-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Digital Notice Board',
  robots: { index: false, follow: false },
};

function asPayload(value: unknown): NoticeboardPayload | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.banners) || !Array.isArray(value.notices)) return null;
  return value as NoticeboardPayload;
}

export default async function DigitalNoticeBoardPage() {
  const initial = asPayload(await fetchCms('noticeboard', undefined, 30, 8000));
  return <DigitalNoticeBoard initial={initial} tenant={safeTenant()} />;
}
