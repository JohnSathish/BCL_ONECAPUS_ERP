import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { QUESTION_PAPER_PDF_MIME_TYPES } from './website-question-bank.constants';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Plain-text metadata: drops markup and control characters, collapses whitespace. */
export function sanitizePlainText(value: unknown, maxLength: number): string {
  if (value == null) return '';
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/** Like {@link sanitizePlainText} but keeps paragraph line breaks. */
export function sanitizeMultilineText(
  value: unknown,
  maxLength: number,
): string {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(CONTROL_CHARS, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeSubjectCode(value: unknown): string {
  return sanitizePlainText(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9 ./_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyQuestionPaper(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
  return slug || 'question-paper';
}

export function safeDownloadFileName(base: string): string {
  const stem =
    base
      .replace(/[^a-zA-Z0-9 ._-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 100) || 'question-paper';
  return `${stem}.pdf`;
}

/** Extension, declared MIME type, PDF signature and size must all check out. */
export function assertValidQuestionPaperPdf(
  file: Express.Multer.File | undefined,
  maxBytes: number,
): asserts file is Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Upload a PDF file');
  }
  if (extname(file.originalname ?? '').toLowerCase() !== '.pdf') {
    throw new BadRequestException('Only .pdf files are allowed');
  }
  if (!QUESTION_PAPER_PDF_MIME_TYPES.has((file.mimetype ?? '').toLowerCase())) {
    throw new BadRequestException('File must be a PDF (application/pdf)');
  }
  const head = file.buffer.subarray(0, 1024).toString('latin1');
  if (!head.includes('%PDF-')) {
    throw new BadRequestException('File content is not a valid PDF');
  }
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    throw new BadRequestException(`PDF exceeds the ${mb} MB upload limit`);
  }
}
