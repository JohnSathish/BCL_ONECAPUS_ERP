import { resolveBrandingAssetUrl } from '@/lib/branding-asset';
import type { InstitutionBranding } from '@/types/branding';
import { sanitizeDisplayText } from '@/utils/display-text';

/** Header block for PDFs, certificates, and ID cards (future-ready). */
export type BrandingDocumentContext = {
  institutionName: string;
  shortName?: string;
  campusName?: string;
  tagline?: string;
  address?: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  badges: string[];
};

export function toBrandingDocumentContext(
  branding: InstitutionBranding | undefined,
): BrandingDocumentContext | null {
  if (!branding?.brandingEnabled) return null;
  return {
    institutionName: branding.displayName,
    shortName: branding.shortName,
    campusName: branding.campusName,
    tagline: sanitizeDisplayText(branding.portalSubtitle),
    address: sanitizeDisplayText(branding.address),
    logoUrl: resolveBrandingAssetUrl(branding.logoUrl),
    primaryColor: branding.primaryColor ?? '#2563eb',
    accentColor: branding.accentColor ?? '#7c3aed',
    badges: branding.badges ?? [],
  };
}
