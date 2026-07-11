export const FEEDBACK_AUDIENCES = [
  'STUDENT',
  'TEACHER',
  'ALUMNI',
  'EMPLOYER',
  'PARENT',
  'STAFF',
] as const;

export type FeedbackAudience = (typeof FEEDBACK_AUDIENCES)[number];

/** 5 = Excellent … 1 = Poor (matches IQAC / NAAC common scale) */
export const FEEDBACK_LIKERT_5 = [
  { rating: 5, label: 'Excellent' },
  { rating: 4, label: 'Very Good' },
  { rating: 3, label: 'Good' },
  { rating: 2, label: 'Average' },
  { rating: 1, label: 'Poor' },
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

export function ratingLabel(rating: number): string {
  return (
    FEEDBACK_LIKERT_5.find((r) => r.rating === rating)?.label ?? String(rating)
  );
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
