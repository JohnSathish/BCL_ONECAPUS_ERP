/** Client-side fallbacks aligned with API branding-defaults. */
export const BRANDING_DEFAULTS = {
  productName: 'Campus ERP',
  productTagline: 'Smart Education Management Platform',
  poweredByText: 'Powered by BaseCode Labs',
  portalSubtitle: 'Campus ERP Portal',
} as const;

export function resolveProductName(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || BRANDING_DEFAULTS.productName;
}

export function resolveProductTagline(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || BRANDING_DEFAULTS.productTagline;
}

export function resolvePoweredByText(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed || BRANDING_DEFAULTS.poweredByText;
}
