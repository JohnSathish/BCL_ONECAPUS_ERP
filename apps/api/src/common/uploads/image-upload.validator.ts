import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_BYTES_BY_KIND: Record<ImageUploadKind, number> = {
  logo: 2 * 1024 * 1024,
  favicon: 512 * 1024,
  profile: 5 * 1024 * 1024,
};

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(bytes: Buffer, sig: number[]) {
  return sig.every((b, i) => bytes[i] === b);
}

function readPngDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (buf.length < 24 || !startsWith(buf, PNG)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  if (!startsWith(buf, JPEG)) return null;
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    const length = buf.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(offset + 5),
        width: buf.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function assertDimensions(
  dims: { width: number; height: number } | null,
  kind: ImageUploadKind,
) {
  if (!dims) return;
  const max = kind === 'logo' ? 2048 : kind === 'profile' ? 4096 : 512;
  const min = kind === 'logo' ? 64 : kind === 'profile' ? 32 : 16;
  if (dims.width > max || dims.height > max) {
    throw new BadRequestException(
      `${kind} dimensions must be at most ${max}×${max}px`,
    );
  }
  if (dims.width < min || dims.height < min) {
    throw new BadRequestException(
      `${kind} dimensions must be at least ${min}×${min}px`,
    );
  }
}

export type ImageUploadKind = 'logo' | 'favicon' | 'profile';

export function validateBrandingImage(
  file: Express.Multer.File | undefined,
  kind: ImageUploadKind,
): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException(`${kind} file is required`);
  }
  const maxBytes = MAX_BYTES_BY_KIND[kind];
  if (file.size > maxBytes) {
    throw new BadRequestException(
      `${kind} must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller`,
    );
  }
  const mime = (file.mimetype ?? '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new BadRequestException(
      'Unsupported image type. Use PNG, JPG, SVG, or WEBP',
    );
  }

  const buf = file.buffer;
  const isSvg = mime === 'image/svg+xml';
  const isPng = startsWith(buf, PNG);
  const isJpeg = startsWith(buf, JPEG);
  const isWebp =
    buf.length > 12 &&
    startsWith(buf, WEBP_RIFF) &&
    buf.toString('ascii', 8, 12) === 'WEBP';

  if (!isSvg && !isPng && !isJpeg && !isWebp) {
    throw new BadRequestException(
      'File content does not match a supported image format',
    );
  }

  if (kind === 'favicon' && file.size > 512 * 1024 && !isSvg) {
    throw new BadRequestException(
      'Favicon should be under 512KB when possible',
    );
  }

  if (!isSvg) {
    const dims = isPng
      ? readPngDimensions(buf)
      : isJpeg
        ? readJpegDimensions(buf)
        : null;
    assertDimensions(dims, kind);
  }

  return file;
}

/** Student/staff profile photos — larger limit, smaller minimum dimensions. */
export function validateProfileImage(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  return validateBrandingImage(file, 'profile');
}

export function extensionForMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'bin';
  }
}
