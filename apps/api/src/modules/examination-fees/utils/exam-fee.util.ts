import {
  EXAM_PAPER_TYPES,
  EVEN_BACKLOG_SEMESTERS,
  ODD_BACKLOG_SEMESTERS,
  type ExamPaperType,
} from '../constants/exam-fee.constants';

export function resolveExamPaperType(input: {
  examPaperType?: string | null;
  deliveryType?: string | null;
  hasPractical?: boolean | null;
}): ExamPaperType {
  const override = (input.examPaperType ?? '').toUpperCase().trim();
  if (
    override === EXAM_PAPER_TYPES.THEORY_ONLY ||
    override === EXAM_PAPER_TYPES.THEORY_PRACTICAL
  ) {
    return override;
  }

  const delivery = (input.deliveryType ?? '').toUpperCase();
  if (
    delivery.includes('THEORY_PRACTICAL') ||
    delivery === 'PRACTICAL' ||
    input.hasPractical
  ) {
    return EXAM_PAPER_TYPES.THEORY_PRACTICAL;
  }
  return EXAM_PAPER_TYPES.THEORY_ONLY;
}

export function allowedBacklogSemesters(cycle: string): number[] {
  return cycle.toUpperCase() === 'EVEN'
    ? [...EVEN_BACKLOG_SEMESTERS]
    : [...ODD_BACKLOG_SEMESTERS];
}

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const ROMAN_SEMESTERS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
] as const;

/** Display semester as Roman numeral (e.g. 3 → "III"). */
export function toRomanSemester(semesterNo: unknown): string {
  const n = Number(semesterNo);
  if (!Number.isFinite(n) || n < 1) return '—';
  return ROMAN_SEMESTERS[Math.floor(n) - 1] ?? String(Math.floor(n));
}
