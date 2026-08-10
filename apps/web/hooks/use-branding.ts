'use client';

import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  BRANDING_DEFAULTS,
  resolvePoweredByText,
  resolveProductName,
  resolveProductTagline,
} from '@/lib/branding-defaults';
import type { InstitutionBranding } from '@/types/branding';

/**
 * Central white-label branding access for authenticated ERP screens.
 * Prefer this over reading hard-coded product names.
 */
export function useBranding() {
  const query = useInstitutionBranding();
  const branding = query.branding;

  return {
    ...query,
    productName: resolveProductName(branding?.productName),
    productTagline: resolveProductTagline(branding?.productTagline),
    poweredByText: resolvePoweredByText(branding?.poweredByText),
    logo: branding?.logoUrl,
    primaryColor: branding?.primaryColor,
    accentColor: branding?.accentColor,
    displayName: branding?.displayName ?? BRANDING_DEFAULTS.productName,
    showPoweredBy: branding?.showPoweredBy ?? true,
    portalSubtitle: branding?.portalSubtitle ?? BRANDING_DEFAULTS.portalSubtitle,
  };
}

export function brandingProductLabel(branding?: InstitutionBranding | null): string {
  return resolveProductName(branding?.productName);
}
