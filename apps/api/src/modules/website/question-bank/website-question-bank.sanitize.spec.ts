import { BadRequestException } from '@nestjs/common';
import {
  assertValidQuestionPaperPdf,
  safeDownloadFileName,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeSubjectCode,
  slugifyQuestionPaper,
} from './website-question-bank.sanitize';

const pdfFile = (overrides: Partial<Express.Multer.File> = {}) =>
  ({
    originalname: 'paper.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj'),
    size: 32,
    ...overrides,
  }) as Express.Multer.File;

describe('website question bank sanitizers', () => {
  it('strips markup and control characters from plain text', () => {
    expect(
      sanitizePlainText('<b>Human</b>\u0000 <script>x</script> Geography', 100),
    ).toBe('Human x Geography');
    expect(sanitizePlainText('a'.repeat(50), 10)).toHaveLength(10);
  });

  it('keeps paragraph breaks in descriptions', () => {
    expect(
      sanitizeMultilineText('Line one\r\n\r\n\r\n<i>Line</i> two', 100),
    ).toBe('Line one\n\nLine two');
  });

  it('normalizes subject codes', () => {
    expect(sanitizeSubjectCode(' geog-305<script> ')).toBe('GEOG-305');
    expect(sanitizeSubjectCode('eng 301 & "x"')).toBe('ENG 301 X');
  });

  it('builds URL-safe slugs and file names', () => {
    expect(slugifyQuestionPaper('GEOG-305: Human Geography 2026')).toBe(
      'geog-305-human-geography-2026',
    );
    expect(slugifyQuestionPaper('***')).toBe('question-paper');
    expect(safeDownloadFileName('GEOG-305 Human "Geography" 2026')).toBe(
      'GEOG-305-Human-Geography-2026.pdf',
    );
  });

  it('accepts a genuine PDF', () => {
    expect(() => assertValidQuestionPaperPdf(pdfFile(), 1024)).not.toThrow();
  });

  it.each([
    ['missing file', undefined],
    ['wrong extension', pdfFile({ originalname: 'paper.exe' })],
    ['wrong mime type', pdfFile({ mimetype: 'text/html' })],
    ['not a PDF body', pdfFile({ buffer: Buffer.from('<html>fake</html>') })],
    ['too large', pdfFile({ size: 5000 })],
  ])('rejects %s', (_label, file) => {
    expect(() => assertValidQuestionPaperPdf(file, 1024)).toThrow(
      BadRequestException,
    );
  });
});
