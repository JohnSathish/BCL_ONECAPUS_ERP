/**
 * School K.G. admission upload rules (web).
 * Keep in sync with apps/api/.../school-upload-image.ts
 */

export const SCHOOL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const SCHOOL_UPLOAD_ACCEPT_ATTR = 'image/jpeg,image/png,.jpg,.jpeg,.png';
export const SCHOOL_UPLOAD_FORMAT_HELP = 'Accepted formats: JPG, JPEG, PNG · Maximum 5 MB per file';
export const SCHOOL_UPLOAD_PDF_REJECTED =
  'PDF files are not supported. Please upload the document as JPG, JPEG, or PNG.';
export const SCHOOL_UPLOAD_UNSUPPORTED =
  'Unsupported file type. Please upload the document as JPG, JPEG, or PNG.';
export const SCHOOL_UPLOAD_TOO_LARGE =
  'File is too large. Maximum 5 MB per file. Please upload JPG, JPEG, or PNG.';

export const SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT = 5;

export function isSchoolPdfFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name || '';
  return type === 'application/pdf' || type.includes('pdf') || /\.pdf$/i.test(name);
}

export function isSchoolAllowedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name || '';
  if (type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png') return true;
  if (/\.jpe?g$/i.test(name) || /\.png$/i.test(name)) return true;
  return false;
}

/** Client-side validation before upload. Returns error message or null. */
export function validateSchoolUploadImageFile(file: File): string | null {
  if (isSchoolPdfFile(file)) return SCHOOL_UPLOAD_PDF_REJECTED;
  if (file.size > SCHOOL_UPLOAD_MAX_BYTES) return SCHOOL_UPLOAD_TOO_LARGE;
  if (!isSchoolAllowedImageFile(file)) return SCHOOL_UPLOAD_UNSUPPORTED;
  return null;
}

export function isSchoolMultiPageEligibleSlot(baseCode: string): boolean {
  return baseCode !== 'PHOTO' && baseCode !== 'PAYMENT_RECEIPT';
}

export function schoolDocumentPageSlotCode(baseCode: string, page: number): string {
  if (page <= 1) return baseCode;
  return `${baseCode}__p${page}`;
}

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
  if (!Number.isFinite(page) || page < 1 || page > SCHOOL_UPLOAD_MAX_PAGES_PER_SLOT) {
    return null;
  }
  return { baseCode, page };
}
