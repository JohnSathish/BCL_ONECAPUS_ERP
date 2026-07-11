import { createHash } from 'crypto';

export function sha256Buffer(buffer: Buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildCanonicalPaperFileName(input: {
  examYear?: number | null;
  examCycle?: string | null;
  semesterNo?: number | null;
  paperCode: string;
  paperType?: string | null;
}) {
  const year = input.examYear ?? new Date().getFullYear();
  const cycle = (input.examCycle ?? 'ODD').toUpperCase().replace(/[^A-Z]/g, '');
  const sem =
    input.semesterNo != null && input.semesterNo > 0
      ? `SEM${input.semesterNo}`
      : 'SEM';
  const code = input.paperCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const typeRaw = (input.paperType ?? 'THEORY').toUpperCase();
  const type = typeRaw.includes('PRACTICAL')
    ? typeRaw.includes('THEORY')
      ? 'THEORY_PRACTICAL'
      : 'PRACTICAL'
    : 'THEORY';
  return `${year}_${cycle || 'ODD'}_${sem}_${code || 'PAPER'}_${type}.pdf`;
}

export function resolveExamCycleFromSemester(semesterNo?: number | null) {
  if (semesterNo == null) return null;
  return semesterNo % 2 === 1 ? 'ODD' : 'EVEN';
}
