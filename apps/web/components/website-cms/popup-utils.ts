import type { WebsitePopupImage } from '@/types/website-cms';

export function resolvePopupImageUrl(
  imageJson: WebsitePopupImage | Record<string, unknown> | null | undefined,
): string | null {
  if (!imageJson || typeof imageJson !== 'object') return null;
  const record = imageJson as Record<string, unknown>;
  if (typeof record.url === 'string' && record.url.trim()) return record.url.trim();
  if (typeof record.publicUrl === 'string' && record.publicUrl.trim()) {
    return record.publicUrl.trim();
  }
  if (typeof record.imageUrl === 'string' && record.imageUrl.trim()) {
    return record.imageUrl.trim();
  }
  return null;
}

export function normalizePopupImageJson(
  imageJson: WebsitePopupImage | Record<string, unknown> | null | undefined,
): WebsitePopupImage | null {
  const url = resolvePopupImageUrl(imageJson);
  if (!url) return null;
  const record = (imageJson && typeof imageJson === 'object' ? imageJson : {}) as Record<
    string,
    unknown
  >;
  return {
    url,
    alt: typeof record.alt === 'string' ? record.alt : undefined,
    caption: typeof record.caption === 'string' ? record.caption : undefined,
  };
}
