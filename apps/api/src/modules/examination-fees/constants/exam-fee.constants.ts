export const EXAM_FEE_HEAD_CODES = {
  SEMESTER_EXAM_FEE: 'SEMESTER_EXAM_FEE',
  CURRENT_THEORY: 'CURRENT_THEORY',
  CURRENT_THEORY_PRACTICAL: 'CURRENT_THEORY_PRACTICAL',
  BACK_THEORY: 'BACK_THEORY',
  BACK_THEORY_PRACTICAL: 'BACK_THEORY_PRACTICAL',
  PROCESSING_FEE: 'PROCESSING_FEE',
  LATE_FEE: 'LATE_FEE',
} as const;

export type ExamFeeHeadCode =
  (typeof EXAM_FEE_HEAD_CODES)[keyof typeof EXAM_FEE_HEAD_CODES];

export const DEFAULT_EXAM_FEE_HEADS: Array<{
  headCode: ExamFeeHeadCode;
  headName: string;
  amount: number;
  unit: 'FLAT' | 'PER_PAPER';
  sortOrder: number;
}> = [
  {
    headCode: EXAM_FEE_HEAD_CODES.SEMESTER_EXAM_FEE,
    headName: 'Semester Examination Fee',
    amount: 800,
    unit: 'FLAT',
    sortOrder: 10,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.CURRENT_THEORY,
    headName: 'Current Semester Theory Paper',
    amount: 100,
    unit: 'PER_PAPER',
    sortOrder: 20,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.CURRENT_THEORY_PRACTICAL,
    headName: 'Current Semester Theory + Practical Paper',
    amount: 150,
    unit: 'PER_PAPER',
    sortOrder: 30,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.BACK_THEORY,
    headName: 'Theory Only Back Paper',
    amount: 250,
    unit: 'PER_PAPER',
    sortOrder: 40,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.BACK_THEORY_PRACTICAL,
    headName: 'Theory + Practical Back Paper',
    amount: 400,
    unit: 'PER_PAPER',
    sortOrder: 50,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.PROCESSING_FEE,
    headName: 'Processing Fee',
    amount: 100,
    unit: 'FLAT',
    sortOrder: 60,
  },
  {
    headCode: EXAM_FEE_HEAD_CODES.LATE_FEE,
    headName: 'Late Fee',
    amount: 0,
    unit: 'FLAT',
    sortOrder: 70,
  },
];

export const EXAM_PAPER_TYPES = {
  THEORY_ONLY: 'THEORY_ONLY',
  THEORY_PRACTICAL: 'THEORY_PRACTICAL',
} as const;

export type ExamPaperType =
  (typeof EXAM_PAPER_TYPES)[keyof typeof EXAM_PAPER_TYPES];

export const EXAM_APPLICATION_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  MANUAL_PAID: 'MANUAL_PAID',
  UNDER_VERIFICATION: 'UNDER_VERIFICATION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CORRECTION_REQUESTED: 'CORRECTION_REQUESTED',
  CANCELLED: 'CANCELLED',
} as const;

export const ODD_BACKLOG_SEMESTERS = [1, 3, 5] as const;
export const EVEN_BACKLOG_SEMESTERS = [2, 4, 6] as const;

export const ENROLLED_REG_STATUSES = [
  'approved',
  'confirmed',
  'registered',
  'pending',
] as const;
