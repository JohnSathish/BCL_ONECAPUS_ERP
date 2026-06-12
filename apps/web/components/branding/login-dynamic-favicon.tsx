'use client';

import { useEffect } from 'react';
import { resolveBrandingAssetUrl } from '@/lib/branding-asset';

type Props = {
  faviconUrl?: string;
};

export function LoginDynamicFavicon({ faviconUrl }: Props) {
  useEffect(() => {
    const href = resolveBrandingAssetUrl(faviconUrl) ?? '/branding/basecode-labs-logo.png';
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = href;
  }, [faviconUrl]);

  return null;
}
