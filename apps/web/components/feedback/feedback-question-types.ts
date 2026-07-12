/** Shared feedback question types (mirrors API constants). */

export const FEEDBACK_QUESTION_TYPES = [
  'LIKERT_5',
  'single_choice',
  'multi_choice',
  'dropdown',
  'short_text',
  'long_text',
  'integer',
  'decimal',
  'rating',
  'yes_no',
  'true_false',
  'date',
  'time',
  'datetime',
  'file_upload',
] as const;

export type FeedbackQuestionType = (typeof FEEDBACK_QUESTION_TYPES)[number];

export const FEEDBACK_QUESTION_TYPE_LABELS: Record<FeedbackQuestionType, string> = {
  LIKERT_5: 'Likert (Excellent–Poor)',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  dropdown: 'Dropdown',
  short_text: 'Short text',
  long_text: 'Long text / paragraph',
  integer: 'Integer',
  decimal: 'Decimal',
  rating: 'Rating scale',
  yes_no: 'Yes / No',
  true_false: 'True / False',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & time',
  file_upload: 'File upload',
};

export type FeedbackOption = { value: string; label: string };

export type FeedbackValidation = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  accept?: string[];
  maxFiles?: number;
};

export type FeedbackShowIf = {
  questionId: string;
  op: 'eq' | 'neq' | 'in';
  value: string | string[] | number | boolean;
};

export type FeedbackConditionalLogic = {
  showIf?: FeedbackShowIf;
};

export type FeedbackQuestionDto = {
  id: string;
  prompt: string;
  description?: string | null;
  helpText?: string | null;
  placeholder?: string | null;
  defaultValue?: unknown;
  category: string;
  required: boolean;
  sortOrder: number;
  questionType?: string;
  options?: FeedbackOption[] | unknown;
  validation?: FeedbackValidation | unknown;
  conditionalLogic?: FeedbackConditionalLogic | unknown;
};

export type FeedbackAnswerValue = {
  rating?: number;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueDate?: string;
  valueJson?: unknown;
};

export const LIKERT_OPTIONS: FeedbackOption[] = [
  { value: '5', label: 'Excellent' },
  { value: '4', label: 'Very Good' },
  { value: '3', label: 'Good' },
  { value: '2', label: 'Average' },
  { value: '1', label: 'Poor' },
];

export function asOptions(raw: unknown, type?: string): FeedbackOption[] {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((o) => {
        if (!o || typeof o !== 'object') return null;
        const r = o as Record<string, unknown>;
        const value = String(r.value ?? r.rating ?? '');
        const label = String(r.label ?? value);
        if (!value) return null;
        return { value, label };
      })
      .filter(Boolean) as FeedbackOption[];
  }
  if (type === 'LIKERT_5') return [...LIKERT_OPTIONS];
  if (type === 'yes_no')
    return [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ];
  if (type === 'true_false')
    return [
      { value: 'true', label: 'True' },
      { value: 'false', label: 'False' },
    ];
  if (type === 'rating') {
    return Array.from({ length: 5 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));
  }
  return [];
}

export function asValidation(raw: unknown): FeedbackValidation {
  if (!raw || typeof raw !== 'object') return {};
  return raw as FeedbackValidation;
}

export function asConditional(raw: unknown): FeedbackConditionalLogic {
  if (!raw || typeof raw !== 'object') return {};
  return raw as FeedbackConditionalLogic;
}

export function comparableAnswer(a: FeedbackAnswerValue | undefined): string | string[] | null {
  if (!a) return null;
  if (a.rating != null) return String(a.rating);
  if (a.valueBool != null) return a.valueBool ? 'true' : 'false';
  if (a.valueNumber != null) return String(a.valueNumber);
  if (a.valueText) return a.valueText;
  if (a.valueDate) return a.valueDate;
  if (Array.isArray(a.valueJson)) return a.valueJson.map(String);
  return null;
}

export function isQuestionVisible(
  q: FeedbackQuestionDto,
  answers: Record<string, FeedbackAnswerValue>,
): boolean {
  const logic = asConditional(q.conditionalLogic);
  const showIf = logic.showIf;
  if (!showIf?.questionId) return true;
  const actual = comparableAnswer(answers[showIf.questionId]);
  if (actual == null) return false;
  const expected = showIf.value;
  const op = showIf.op ?? 'eq';
  if (op === 'in') {
    const list = Array.isArray(expected) ? expected.map(String) : [String(expected)];
    if (Array.isArray(actual)) return actual.some((x) => list.includes(String(x)));
    return list.includes(String(actual));
  }
  const a = Array.isArray(actual) ? actual.join(',') : String(actual);
  const e = Array.isArray(expected) ? expected.map(String).join(',') : String(expected);
  if (op === 'neq') return a !== e;
  return a === e;
}

export function answerToPayload(
  questionId: string,
  value: FeedbackAnswerValue,
): Record<string, unknown> {
  return {
    questionId,
    ...(value.rating != null ? { rating: value.rating } : {}),
    ...(value.valueText != null ? { valueText: value.valueText } : {}),
    ...(value.valueNumber != null ? { valueNumber: value.valueNumber } : {}),
    ...(value.valueBool != null ? { valueBool: value.valueBool } : {}),
    ...(value.valueDate != null ? { valueDate: value.valueDate } : {}),
    ...(value.valueJson != null ? { valueJson: value.valueJson } : {}),
  };
}
