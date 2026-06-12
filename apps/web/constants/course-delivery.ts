export const CREDIT_CALCULATION_MODES = ['AUTO_CALCULATED', 'MANUAL_OVERRIDE'] as const;
export type CreditCalculationMode = (typeof CREDIT_CALCULATION_MODES)[number];

export const ATTENDANCE_MODES = [
  'REGULAR',
  'MENTOR_APPROVAL',
  'ACTIVITY_COMPLETION',
  'NONE',
  'SUBMISSION',
] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

export const COURSE_DELIVERY_TYPES = [
  'THEORY',
  'PRACTICAL',
  'THEORY_PRACTICAL',
  'PROJECT',
  'FIELD_WORK',
  'INTERNSHIP',
  'APPRENTICESHIP',
  'COMMUNITY_ENGAGEMENT',
  'DISSERTATION',
  'VIVA',
  'SEMINAR',
  'SKILL_LAB',
  'STUDIO',
] as const;

export type CourseDeliveryType = (typeof COURSE_DELIVERY_TYPES)[number];

export type CourseDeliveryProfile = {
  creditCalculationMode: CreditCalculationMode;
  requiresTheorySplit: boolean;
  requiresPracticalSplit: boolean;
  requiresWeeklyHours: boolean;
  requiresSplitContactHours: boolean;
};

const AUTO_PROFILE: CourseDeliveryProfile = {
  creditCalculationMode: 'AUTO_CALCULATED',
  requiresTheorySplit: true,
  requiresPracticalSplit: true,
  requiresWeeklyHours: true,
  requiresSplitContactHours: true,
};

const MANUAL_EXPERIENTIAL_PROFILE: CourseDeliveryProfile = {
  creditCalculationMode: 'MANUAL_OVERRIDE',
  requiresTheorySplit: false,
  requiresPracticalSplit: false,
  requiresWeeklyHours: false,
  requiresSplitContactHours: false,
};

export const COURSE_DELIVERY_PROFILES: Record<CourseDeliveryType, CourseDeliveryProfile> = {
  THEORY: { ...AUTO_PROFILE, requiresPracticalSplit: false },
  PRACTICAL: { ...AUTO_PROFILE, requiresTheorySplit: false },
  THEORY_PRACTICAL: AUTO_PROFILE,
  SKILL_LAB: AUTO_PROFILE,
  STUDIO: AUTO_PROFILE,
  PROJECT: MANUAL_EXPERIENTIAL_PROFILE,
  FIELD_WORK: MANUAL_EXPERIENTIAL_PROFILE,
  INTERNSHIP: MANUAL_EXPERIENTIAL_PROFILE,
  APPRENTICESHIP: MANUAL_EXPERIENTIAL_PROFILE,
  COMMUNITY_ENGAGEMENT: MANUAL_EXPERIENTIAL_PROFILE,
  DISSERTATION: MANUAL_EXPERIENTIAL_PROFILE,
  VIVA: MANUAL_EXPERIENTIAL_PROFILE,
  SEMINAR: MANUAL_EXPERIENTIAL_PROFILE,
};

export const COURSE_DELIVERY_LABELS: Record<CourseDeliveryType, string> = {
  THEORY: 'Theory',
  PRACTICAL: 'Practical',
  THEORY_PRACTICAL: 'Theory + Practical',
  PROJECT: 'Project',
  FIELD_WORK: 'Field work',
  INTERNSHIP: 'Internship',
  APPRENTICESHIP: 'Apprenticeship',
  COMMUNITY_ENGAGEMENT: 'Community engagement',
  DISSERTATION: 'Dissertation',
  VIVA: 'Viva',
  SEMINAR: 'Seminar',
  SKILL_LAB: 'Skill lab',
  STUDIO: 'Studio',
};

export const COURSE_DELIVERY_ALIASES: Record<string, CourseDeliveryType> = {
  FIELDWORK: 'FIELD_WORK',
  MIXED: 'THEORY_PRACTICAL',
  MIXED_MODE: 'THEORY_PRACTICAL',
  COMMUNITYENGAGEMENT: 'COMMUNITY_ENGAGEMENT',
  SKILLLAB: 'SKILL_LAB',
};

export function isCourseDeliveryType(value: string): value is CourseDeliveryType {
  return (COURSE_DELIVERY_TYPES as readonly string[]).includes(value);
}

export function resolveDeliveryType(raw: string): CourseDeliveryType | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (isCourseDeliveryType(normalized)) return normalized;
  return COURSE_DELIVERY_ALIASES[normalized] ?? null;
}

export function getDeliveryProfile(deliveryType: CourseDeliveryType): CourseDeliveryProfile {
  return COURSE_DELIVERY_PROFILES[deliveryType];
}

export function isManualCreditDelivery(deliveryType: CourseDeliveryType): boolean {
  return getDeliveryProfile(deliveryType).creditCalculationMode === 'MANUAL_OVERRIDE';
}

export const MANUAL_CREDIT_HELPER_TEXT =
  'This academic component uses direct credit allocation without theory/practical split.';
