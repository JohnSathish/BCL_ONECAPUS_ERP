'use client';

import { useEffect } from 'react';
import { useBranding } from '@/hooks/use-branding';

/** Sets browser tab title from tenant product branding after login. */
export function BrandingDocumentTitle() {
  const { productName, displayName, active } = useBranding();

  useEffect(() => {
    if (!active) return;
    const title = productName ? `${productName} · ${displayName}` : displayName || 'Campus ERP';
    document.title = title;
  }, [active, productName, displayName]);

  return null;
}
