import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export const ID_CARD_BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;

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

export function readImageDimensions(
  buf: Buffer,
  mime: string,
): { width: number; height: number } | null {
  const lower = mime.toLowerCase();
  if (lower === 'image/png') return readPngDimensions(buf);
  if (lower === 'image/jpeg' || lower === 'image/jpg')
    return readJpegDimensions(buf);
  if (lower === 'image/webp') return null;
  return null;
}

export function validateIdCardBackgroundImage(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Background image file is required');
  }
  if (file.size > ID_CARD_BACKGROUND_MAX_BYTES) {
    throw new BadRequestException('Background image must be 10MB or smaller');
  }
  const mime = (file.mimetype ?? '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new BadRequestException(
      'Unsupported image type. Use PNG, JPG, JPEG, or WEBP',
    );
  }

  const buf = file.buffer;
  const isPng = startsWith(buf, PNG);
  const isJpeg = startsWith(buf, JPEG);
  const isWebp =
    buf.length > 12 &&
    startsWith(buf, WEBP_RIFF) &&
    buf.toString('ascii', 8, 12) === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    throw new BadRequestException(
      'File content does not match a supported image format',
    );
  }

  return file;
}

export function extensionForBackgroundMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}
