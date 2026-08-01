import { resolveUploadAssetUrl, resolveUploadAssetUrlForPrint } from '@/lib/branding-asset';

export function resolveInstitutionSignatureUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return resolveUploadAssetUrl(url) ?? url;
}

/** Nest-absolute signature URL for CR80 print/PDF (Puppeteer). */
export function resolveInstitutionSignatureUrlForPrint(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  return resolveUploadAssetUrlForPrint(url) ?? url;
}
