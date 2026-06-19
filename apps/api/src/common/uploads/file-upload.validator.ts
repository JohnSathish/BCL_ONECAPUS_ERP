import { BadRequestException } from '@nestjs/common';

const BLOCKED_EXTENSIONS = new Set([
  '.php',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.sh',
  '.bat',
  '.cmd',
  '.exe',
  '.dll',
  '.msi',
  '.html',
  '.htm',
  '.svg',
]);

const PDF = [0x25, 0x50, 0x44, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

export type DocumentUploadKind = 'photo' | 'certificate' | 'pdf' | 'document';

const MAX_BYTES: Record<DocumentUploadKind, number> = {
  photo: 5 * 1024 * 1024,
  certificate: 10 * 1024 * 1024,
  pdf: 15 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

const ALLOWED_MIME: Record<DocumentUploadKind, Set<string>> = {
  photo: new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']),
  certificate: new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
  ]),
  pdf: new Set(['application/pdf']),
  document: new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ]),
};

function startsWith(buf: Buffer, sig: number[]) {
  return sig.every((b, i) => buf[i] === b);
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function validateDocumentUpload(
  file: Express.Multer.File | undefined,
  kind: DocumentUploadKind,
): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required');
  }

  const ext = extOf(file.originalname ?? '');
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(`File type ${ext} is not allowed`);
  }

  const max = MAX_BYTES[kind];
  if (file.size > max) {
    throw new BadRequestException(
      `File must be ${Math.round(max / (1024 * 1024))}MB or smaller`,
    );
  }

  const mime = (file.mimetype ?? '').toLowerCase();
  if (!ALLOWED_MIME[kind].has(mime)) {
    throw new BadRequestException('Unsupported file type');
  }

  const buf = file.buffer;
  const isPdf = startsWith(buf, PDF);
  const isPng = startsWith(buf, PNG);
  const isJpeg = startsWith(buf, JPEG);

  if (mime.includes('pdf') && !isPdf) {
    throw new BadRequestException('File content does not match PDF format');
  }
  if (mime.includes('png') && !isPng) {
    throw new BadRequestException('File content does not match PNG format');
  }
  if ((mime.includes('jpeg') || mime.includes('jpg')) && !isJpeg) {
    throw new BadRequestException('File content does not match JPEG format');
  }

  return file;
}
