/** Normalize stored photo/file paths to a browser-ready `/uploads/...` URL. */
export function toPublicUploadUrl(path?: string | null): string | null {
  if (!path?.trim()) return null;
  const trimmed = path.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) return trimmed;
  const normalized = trimmed.replace(/^\/+/, '');
  if (normalized.startsWith('uploads/')) return `/${normalized}`;
  return `/uploads/${normalized}`;
}
