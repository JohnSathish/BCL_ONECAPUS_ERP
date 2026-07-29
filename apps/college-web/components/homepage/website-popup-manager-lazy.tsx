'use client';

import dynamic from 'next/dynamic';
import type { PublicPopup } from '@/lib/popup-rules';

const WebsitePopupManager = dynamic(
  () =>
    import('@/components/homepage/website-popup-manager').then((mod) => ({
      default: mod.WebsitePopupManager,
    })),
  { ssr: false },
);

type Props = {
  popups: PublicPopup[];
};

export function WebsitePopupManagerLazy({ popups }: Props) {
  if (!popups.length) return null;
  return <WebsitePopupManager popups={popups} />;
}
