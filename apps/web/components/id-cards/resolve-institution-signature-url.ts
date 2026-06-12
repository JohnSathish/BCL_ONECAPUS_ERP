import { resolveUploadAssetUrl } from '@/lib/branding-asset';

export function resolveInstitutionSignatureUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return resolveUploadAssetUrl(url) ?? url;
}
