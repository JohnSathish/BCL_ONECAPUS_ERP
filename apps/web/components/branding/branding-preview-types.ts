'use client';

import type { InstitutionBranding } from '@/types/branding';

export type BrandingPreviewSnapshot = {
  displayName: string;
  shortName?: string;
  campusName?: string;
  portalSubtitle?: string;
  address?: string;
  logoPreview?: string;
  faviconPreview?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  loginBackgroundStyle: InstitutionBranding['loginBackgroundStyle'];
  showPoweredBy: boolean;
  brandingEnabled: boolean;
  badges: string[];
};

export function toPreviewSnapshot(
  values: Partial<InstitutionBranding>,
  logoPreview?: string,
  faviconPreview?: string,
): BrandingPreviewSnapshot {
  return {
    displayName: values.displayName ?? 'Institution Name',
    shortName: values.shortName,
    campusName: values.campusName,
    portalSubtitle: values.portalSubtitle,
    address: values.address,
    logoPreview,
    faviconPreview,
    primaryColor: values.primaryColor ?? '#2563eb',
    accentColor: values.accentColor ?? '#7c3aed',
    sidebarColor: values.sidebarColor,
    loginBackgroundStyle: values.loginBackgroundStyle ?? 'gradient',
    showPoweredBy: values.showPoweredBy ?? true,
    brandingEnabled: values.brandingEnabled ?? true,
    badges: values.badges ?? [],
  };
}
