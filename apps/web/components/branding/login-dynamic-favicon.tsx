'use client';

import { useEffect } from 'react';
import { DEFAULT_FAVICON, resolveBrandingAssetUrl } from '@/lib/branding-asset';

type Props = {
  faviconUrl?: string;
};

function applyFavicon(href: string) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export function LoginDynamicFavicon({ faviconUrl }: Props) {
  useEffect(() => {
    const tenantHref = resolveBrandingAssetUrl(faviconUrl);
    if (!tenantHref) {
      applyFavicon(DEFAULT_FAVICON);
      return;
    }

    const probe = new Image();
    probe.onload = () => applyFavicon(tenantHref);
    probe.onerror = () => applyFavicon(DEFAULT_FAVICON);
    probe.src = tenantHref;
  }, [faviconUrl]);

  return null;
}
