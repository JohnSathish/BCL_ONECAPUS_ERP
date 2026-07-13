import { createHash } from 'crypto';

export function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildCanonicalSyllabusFileName(input: {
  academicYear?: string | number | null;
  semesterNo?: number | null;
  paperCode: string;
  category?: string | null;
}) {
  const year = String(input.academicYear ?? new Date().getFullYear())
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const sem =
    input.semesterNo != null && input.semesterNo > 0
      ? `SEM${input.semesterNo}`
      : 'SEM';
  const code =
    input.paperCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'PAPER';
  const category = (input.category ?? 'SYLLABUS')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');

  return `${year}_${sem}_${code}_${category || 'SYLLABUS'}.pdf`;
}
