'use client';

import { useEffect } from 'react';
import { DEFAULT_FAVICON, resolveBrandingAssetUrl } from '@/lib/branding-asset';

type Props = {
  faviconUrl?: string;
  /** When true (default), always use BCL product favicon on login. */
  forceProductBrand?: boolean;
};

function applyFavicon(href: string) {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']"),
  );
  if (!links.length) {
    const link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
    links.push(link);
  }
  for (const link of links) {
    link.type = 'image/png';
    link.href = href;
  }
}

/**
 * Sets the browser tab icon on login.
 * Product login (BCL OneCampus) always uses the BaseCode Labs mark unless
 * forceProductBrand is false and a working tenant favicon URL is provided.
 */
export function LoginDynamicFavicon({ faviconUrl, forceProductBrand = true }: Props) {
  useEffect(() => {
    if (forceProductBrand) {
      applyFavicon(`${DEFAULT_FAVICON}?v=bcl`);
      return;
    }

    const tenantHref = resolveBrandingAssetUrl(faviconUrl);
    if (!tenantHref) {
      applyFavicon(`${DEFAULT_FAVICON}?v=bcl`);
      return;
    }

    const probe = new Image();
    probe.onload = () => applyFavicon(tenantHref);
    probe.onerror = () => applyFavicon(`${DEFAULT_FAVICON}?v=bcl`);
    probe.src = tenantHref;
  }, [faviconUrl, forceProductBrand]);

  return null;
}
