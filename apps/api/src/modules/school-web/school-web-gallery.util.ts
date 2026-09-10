export const GALLERY_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;
export const GALLERY_VISIBILITIES = ['PUBLIC', 'PRIVATE', 'STAFF'] as const;
export const GALLERY_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
export const GALLERY_MAX_BYTES = 8 * 1024 * 1024;
export const GALLERY_MAX_FILES = 40;
export const HERO_SLIDE_MAX = 15;
export const HERO_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

export function slugifyGallery(input: string) {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return slug || 'album';
}

export function isPublicAlbum(row: {
  status: string;
  visibility: string;
  published?: boolean;
  deletedAt?: Date | string | null;
  scheduledAt?: Date | string | null;
  now?: Date;
}) {
  if (row.deletedAt) return false;
  if (row.visibility !== 'PUBLIC') return false;
  if (row.status !== 'PUBLISHED') return false;
  const now = row.now ?? new Date();
  if (row.scheduledAt && new Date(row.scheduledAt) > now) return false;
  return true;
}

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(bytes: Buffer, sig: number[]) {
  return sig.every((b, i) => bytes[i] === b);
}

export function galleryFileLooksSafe(
  file: {
    originalname?: string;
    mimetype?: string;
    size?: number;
    buffer?: Buffer;
  },
  maxBytes = GALLERY_MAX_BYTES,
) {
  const mime = (file.mimetype || '').toLowerCase();
  if (
    !GALLERY_IMAGE_MIMES.includes(mime as (typeof GALLERY_IMAGE_MIMES)[number])
  )
    return false;
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return false;
  if ((file.size ?? 0) > maxBytes) return false;
  const buf = file.buffer;
  if (!buf?.length) return false;
  const isPng = startsWith(buf, PNG);
  const isJpeg = startsWith(buf, JPEG);
  const isWebp =
    buf.length > 12 &&
    startsWith(buf, WEBP_RIFF) &&
    buf.toString('ascii', 8, 12) === 'WEBP';
  return isPng || isJpeg || isWebp;
}

export function publicAssetUrl(storageKey: string, variants?: unknown) {
  const bag =
    variants && typeof variants === 'object'
      ? (variants as Record<string, unknown>)
      : {};
  const thumb = typeof bag.thumb === 'string' ? bag.thumb : '';
  const card = typeof bag.card === 'string' ? bag.card : '';
  const original = typeof bag.original === 'string' ? bag.original : storageKey;
  return {
    original: `/uploads/${original}`,
    card: `/uploads/${card || original}`,
    thumb: `/uploads/${thumb || card || original}`,
  };
}
