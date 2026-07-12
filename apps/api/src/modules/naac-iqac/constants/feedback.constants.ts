export const FEEDBACK_AUDIENCES = [
  'STUDENT',
  'TEACHER',
  'ALUMNI',
  'EMPLOYER',
  'PARENT',
  'STAFF',
] as const;

export type FeedbackAudience = (typeof FEEDBACK_AUDIENCES)[number];

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

export const FEEDBACK_QUESTION_TYPE_LABELS: Record<
  FeedbackQuestionType,
  string
> = {
  LIKERT_5: 'Likert scale (Excellent–Poor)',
  single_choice: 'Single choice (radio)',
  multi_choice: 'Multiple choice (checkbox)',
  dropdown: 'Dropdown list',
  short_text: 'Short text answer',
  long_text: 'Long text / paragraph',
  integer: 'Numeric (integer)',
  decimal: 'Decimal number',
  rating: 'Rating scale',
  yes_no: 'Yes / No',
  true_false: 'True / False',
  date: 'Date',
  time: 'Time',
  datetime: 'Date & time',
  file_upload: 'File upload',
};

/** 5 = Excellent … 1 = Poor (matches IQAC / NAAC common scale) */
export const FEEDBACK_LIKERT_5 = [
  { rating: 5, label: 'Excellent', value: '5' },
  { rating: 4, label: 'Very Good', value: '4' },
  { rating: 3, label: 'Good', value: '3' },
  { rating: 2, label: 'Average', value: '2' },
  { rating: 1, label: 'Poor', value: '1' },
] as const;

export const FEEDBACK_YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const;

export const FEEDBACK_TRUE_FALSE_OPTIONS = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' },
] as const;

export const FEEDBACK_CATEGORIES = [
  'CURRICULUM',
  'TEACHING',
  'FACULTY',
  'INFRASTRUCTURE',
  'ICT',
  'LIBRARY',
  'LABORATORY',
  'STUDENT_SUPPORT',
  'EXAMINATION',
  'PLACEMENT',
  'ADMINISTRATION',
  'HOSTEL',
  'TRANSPORT',
  'SPORTS',
  'OVERALL',
] as const;

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

export function ratingLabel(rating: number): string {
  return (
    FEEDBACK_LIKERT_5.find((r) => r.rating === rating)?.label ?? String(rating)
  );
}

export function defaultOptionsForType(type: string): FeedbackOption[] {
  if (type === 'LIKERT_5') {
    return FEEDBACK_LIKERT_5.map((r) => ({
      value: String(r.rating),
      label: r.label,
    }));
  }
  if (type === 'yes_no') {
    return FEEDBACK_YES_NO_OPTIONS.map((o) => ({ ...o }));
  }
  if (type === 'true_false') {
    return FEEDBACK_TRUE_FALSE_OPTIONS.map((o) => ({ ...o }));
  }
  if (type === 'rating') {
    return Array.from({ length: 5 }, (_, i) => {
      const n = i + 1;
      return { value: String(n), label: String(n) };
    });
  }
  return [];
}

export function isObjectiveType(type: string): boolean {
  return [
    'LIKERT_5',
    'single_choice',
    'multi_choice',
    'dropdown',
    'rating',
    'yes_no',
    'true_false',
  ].includes(type);
}

export function isNumericType(type: string): boolean {
  return ['integer', 'decimal', 'rating', 'LIKERT_5'].includes(type);
}

export function isTextType(type: string): boolean {
  return ['short_text', 'long_text'].includes(type);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isCampaignOpen(campaign: {
  enabled: boolean;
  status: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
}): boolean {
  if (!campaign.enabled) return false;
  if (campaign.status === 'CLOSED' || campaign.status === 'DRAFT') return false;
  const today = startOfDay(new Date());
  if (campaign.startsAt) {
    const start = startOfDay(new Date(campaign.startsAt));
    if (today < start) return false;
  }
  if (campaign.endsAt) {
    const end = startOfDay(new Date(campaign.endsAt));
    if (today > end) return false;
  }
  return true;
}

export type FeedbackSeedQuestion = {
  category: string;
  prompt: string;
  required?: boolean;
  questionType?: FeedbackQuestionType;
};

export const STUDENT_FEEDBACK_SEED: FeedbackSeedQuestion[] = [
  {
    category: 'OVERALL',
    prompt:
      'How would you rate your overall association / experience with the college?',
  },
  {
    category: 'CURRICULUM',
    prompt:
      'How would you rate the courses on facilitating understanding of theory and fundamental principles?',
  },
  {
    category: 'TEACHING',
    prompt:
      'How would you rate the quality of teaching and classroom delivery?',
  },
  {
    category: 'FACULTY',
    prompt: 'How would you rate faculty effectiveness and academic mentoring?',
  },
  {
    category: 'ICT',
    prompt:
      'How would you rate ICT-enabled teaching and internet / Wi-Fi facilities?',
  },
  {
    category: 'LIBRARY',
    prompt: 'How would you rate library facilities and learning resources?',
  },
  {
    category: 'LABORATORY',
    prompt:
      'How would you rate laboratory / practical facilities (if applicable)?',
  },
  {
    category: 'INFRASTRUCTURE',
    prompt:
      'How would you rate campus infrastructure, cleanliness and classroom environment?',
  },
  {
    category: 'STUDENT_SUPPORT',
    prompt:
      'How would you rate student support services, grievance redressal and mentoring?',
  },
  {
    category: 'EXAMINATION',
    prompt:
      'How would you rate the examination system and academic assessment?',
  },
  {
    category: 'PLACEMENT',
    prompt:
      'How would you rate career guidance, placement support and skill development?',
  },
  {
    category: 'OVERALL',
    prompt: 'Overall satisfaction with the institution',
  },
];

export const TEACHER_FEEDBACK_SEED: FeedbackSeedQuestion[] = [
  {
    category: 'CURRICULUM',
    prompt:
      'How would you rate the relevance and flexibility of the curriculum for your subject?',
  },
  {
    category: 'TEACHING',
    prompt:
      'How would you rate institutional support for teaching quality and pedagogy?',
  },
  {
    category: 'FACULTY',
    prompt:
      'How would you rate opportunities for faculty development and research?',
  },
  {
    category: 'ICT',
    prompt:
      'How would you rate ICT facilities available for teaching and evaluation?',
  },
  {
    category: 'LIBRARY',
    prompt: 'How would you rate library / e-resources support for faculty?',
  },
  {
    category: 'LABORATORY',
    prompt:
      'How would you rate laboratory / practical infrastructure (if applicable)?',
  },
  {
    category: 'INFRASTRUCTURE',
    prompt:
      'How would you rate classroom and campus infrastructure for teaching?',
  },
  {
    category: 'ADMINISTRATION',
    prompt: 'How would you rate administrative support for academic processes?',
  },
  {
    category: 'EXAMINATION',
    prompt: 'How would you rate examination and evaluation systems?',
  },
  {
    category: 'STUDENT_SUPPORT',
    prompt: 'How would you rate student mentoring and support mechanisms?',
  },
  {
    category: 'OVERALL',
    prompt:
      'Overall satisfaction with the working environment at the institution',
  },
];

export const ALUMNI_FEEDBACK_SEED: FeedbackSeedQuestion[] = [
  {
    category: 'CURRICULUM',
    prompt:
      'How would you rate the curriculum in preparing you for higher studies / career?',
  },
  {
    category: 'TEACHING',
    prompt:
      'How would you rate the quality of teaching during your study period?',
  },
  {
    category: 'FACULTY',
    prompt: 'How would you rate faculty guidance and mentoring you received?',
  },
  {
    category: 'INFRASTRUCTURE',
    prompt: 'How would you rate campus facilities during your student years?',
  },
  {
    category: 'PLACEMENT',
    prompt:
      'How would you rate career guidance and placement support received?',
  },
  {
    category: 'STUDENT_SUPPORT',
    prompt:
      'How would you rate extracurricular and student support activities?',
  },
  {
    category: 'ADMINISTRATION',
    prompt:
      'How would you rate administrative services during your association?',
  },
  {
    category: 'OVERALL',
    prompt: 'Overall satisfaction with your alma mater',
  },
  {
    category: 'OVERALL',
    prompt: 'How likely are you to recommend this institution to others?',
  },
];

export function seedQuestionsForAudience(
  audience: string,
): FeedbackSeedQuestion[] {
  if (audience === 'TEACHER') return TEACHER_FEEDBACK_SEED;
  if (audience === 'ALUMNI') return ALUMNI_FEEDBACK_SEED;
  return STUDENT_FEEDBACK_SEED;
}

/** Normalize answer value for conditional showIf comparison */
export function answerComparableValue(answer: {
  rating?: number | null;
  ratingLabel?: string | null;
  valueText?: string | null;
  valueNumber?: number | string | null;
  valueBool?: boolean | null;
  valueDate?: Date | string | null;
  valueJson?: unknown;
}): string | string[] | null {
  if (answer.rating != null) return String(answer.rating);
  if (answer.valueBool != null) return answer.valueBool ? 'true' : 'false';
  if (answer.valueNumber != null && answer.valueNumber !== '') {
    return String(answer.valueNumber);
  }
  if (answer.valueText != null && answer.valueText !== '')
    return answer.valueText;
  if (answer.valueDate != null) {
    return typeof answer.valueDate === 'string'
      ? answer.valueDate
      : answer.valueDate.toISOString();
  }
  if (Array.isArray(answer.valueJson)) {
    return answer.valueJson.map(String);
  }
  if (answer.valueJson && typeof answer.valueJson === 'object') {
    const v = (answer.valueJson as { value?: unknown }).value;
    if (v != null) return String(v);
  }
  if (answer.ratingLabel) return answer.ratingLabel;
  return null;
}

export function evaluateShowIf(
  showIf: FeedbackShowIf | undefined,
  answersByQuestionId: Map<string, ReturnType<typeof answerComparableValue>>,
): boolean {
  if (!showIf?.questionId) return true;
  const actual = answersByQuestionId.get(showIf.questionId);
  if (actual == null) return false;
  const expected = showIf.value;
  const op = showIf.op ?? 'eq';

  if (op === 'in') {
    const list = Array.isArray(expected)
      ? expected.map(String)
      : [String(expected)];
    if (Array.isArray(actual))
      return actual.some((a) => list.includes(String(a)));
    return list.includes(String(actual));
  }

  const actualStr = Array.isArray(actual) ? actual.join(',') : String(actual);
  const expectedStr = Array.isArray(expected)
    ? expected.map(String).join(',')
    : String(expected);

  if (op === 'neq') return actualStr !== expectedStr;
  return actualStr === expectedStr;
}
