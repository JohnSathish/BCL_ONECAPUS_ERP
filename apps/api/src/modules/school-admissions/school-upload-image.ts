/**
 * School K.G. admission upload rules: JPG / JPEG / PNG only (no PDF / WEBP).
 */

export const SCHOOL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const SCHOOL_UPLOAD_ACCEPT_ATTR = 'image/jpeg,image/png,.jpg,.jpeg,.png';
export const SCHOOL_UPLOAD_FORMAT_HELP =
  'Accepted formats: JPG, JPEG, PNG · Maximum 5 MB per file';
export const SCHOOL_UPLOAD_PDF_REJECTED =
  'PDF files are not supported. Please upload the document as JPG, JPEG, or PNG.';
export const SCHOOL_UPLOAD_UNSUPPORTED =
  'Unsupported file type. Please upload the document as JPG, JPEG, or PNG.';
export const SCHOOL_UPLOAD_TOO_LARGE =
  'File is too large. Maximum 5 MB per file. Please upload JPG, JPEG, or PNG.';

export const SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT = 5;

export type SchoolUploadImageKind = 'jpeg' | 'png';

export function startsWithBytes(buf: Uint8Array, sig: number[]) {
  return sig.every((b, i) => buf[i] === b);
}

export function detectSchoolUploadImageKind(
  buffer: Uint8Array,
): SchoolUploadImageKind | 'pdf' | 'webp' | null {
  if (!buffer?.length) return null;
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  if (
    buffer.length >= 12 &&
    String.fromCharCode(...buffer.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...buffer.slice(8, 12)) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export function schoolUploadExtension(kind: SchoolUploadImageKind): string {
  return kind === 'jpeg' ? 'jpg' : 'png';
}

export function schoolUploadMime(kind: SchoolUploadImageKind): string {
  return kind === 'jpeg' ? 'image/jpeg' : 'image/png';
}

/** Base slot or page variant: BIRTH_CERT, BIRTH_CERT__p2, … */
export function parseSchoolDocumentSlotCode(slotCode: string): {
  baseCode: string;
  page: number;
} | null {
  const raw = slotCode.trim();
  if (!raw) return null;
  const m = /^([A-Z0-9_]+)(?:__p([2-9]|[1-9]\d))?$/i.exec(raw);
  if (!m) return null;
  const baseCode = m[1]!.toUpperCase();
  const page = m[2] ? Number(m[2]) : 1;
  if (
    !Number.isFinite(page) ||
    page < 1 ||
    page > SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT
  ) {
    return null;
  }
  return { baseCode, page };
}

export function schoolDocumentPageSlotCode(
  baseCode: string,
  page: number,
): string {
  if (page <= 1) return baseCode;
  return `${baseCode}__p${page}`;
}

export function isSchoolMultiPageEligibleSlot(baseCode: string): boolean {
  return baseCode !== 'PHOTO' && baseCode !== 'PAYMENT_RECEIPT';
}
