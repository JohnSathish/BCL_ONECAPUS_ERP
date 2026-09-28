const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const UUID_SUFFIX =
  /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

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
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'question-paper';
}

/** Readable, stable URL slug that still resolves by id: `<words>-<uuid>`. */
export function questionPaperSlug(paper: {
  id: string;
  paperCode: string;
  paperName: string;
  examYear: number | null;
}): string {
  const words = slugifyQuestionPaper(
    [paper.paperCode, paper.paperName, paper.examYear]
      .filter(Boolean)
      .join(' '),
  );
  return `${words}-${paper.id.toLowerCase()}`;
}

export function paperIdFromSlug(slug: string): string | null {
  return UUID_SUFFIX.exec(slug.toLowerCase())?.[1] ?? null;
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
