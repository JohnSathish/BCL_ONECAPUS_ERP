export const CREDIT_CALCULATION_MODES = [
  'AUTO_CALCULATED',
  'MANUAL_OVERRIDE',
] as const;
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
  defaultAttendanceMode: AttendanceMode;
  defaultRequiresTimetableSlots: boolean;
  defaultLabRequired: boolean;
};

const AUTO_PROFILE: CourseDeliveryProfile = {
  creditCalculationMode: 'AUTO_CALCULATED',
  requiresTheorySplit: true,
  requiresPracticalSplit: true,
  requiresWeeklyHours: true,
  requiresSplitContactHours: true,
  defaultAttendanceMode: 'REGULAR',
  defaultRequiresTimetableSlots: true,
  defaultLabRequired: false,
};

const MANUAL_EXPERIENTIAL_PROFILE: CourseDeliveryProfile = {
  creditCalculationMode: 'MANUAL_OVERRIDE',
  requiresTheorySplit: false,
  requiresPracticalSplit: false,
  requiresWeeklyHours: false,
  requiresSplitContactHours: false,
  defaultAttendanceMode: 'MENTOR_APPROVAL',
  defaultRequiresTimetableSlots: false,
  defaultLabRequired: false,
};

export const COURSE_DELIVERY_PROFILES: Record<
  CourseDeliveryType,
  CourseDeliveryProfile
> = {
  THEORY: {
    ...AUTO_PROFILE,
    requiresPracticalSplit: false,
  },
  PRACTICAL: {
    ...AUTO_PROFILE,
    requiresTheorySplit: false,
  },
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

/** Import / free-text aliases → canonical delivery type */
export const COURSE_DELIVERY_ALIASES: Record<string, CourseDeliveryType> = {
  FIELDWORK: 'FIELD_WORK',
  FIELD_WORK: 'FIELD_WORK',
  MIXED: 'THEORY_PRACTICAL',
  MIXED_MODE: 'THEORY_PRACTICAL',
  THEORY_PRACTICAL: 'THEORY_PRACTICAL',
  HYBRID: 'THEORY_PRACTICAL',
  COMMUNITY_ENGAGEMENT: 'COMMUNITY_ENGAGEMENT',
  COMMUNITYENGAGEMENT: 'COMMUNITY_ENGAGEMENT',
  SKILL_LAB: 'SKILL_LAB',
  SKILLLAB: 'SKILL_LAB',
};

export function isCourseDeliveryType(
  value: string,
): value is CourseDeliveryType {
  return (COURSE_DELIVERY_TYPES as readonly string[]).includes(value);
}

export function resolveDeliveryType(raw: string): CourseDeliveryType | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (isCourseDeliveryType(normalized)) return normalized;
  return COURSE_DELIVERY_ALIASES[normalized] ?? null;
}

export function getDeliveryProfile(
  deliveryType: CourseDeliveryType,
): CourseDeliveryProfile {
  return COURSE_DELIVERY_PROFILES[deliveryType];
}

export function isManualCreditDelivery(
  deliveryType: CourseDeliveryType,
): boolean {
  return (
    getDeliveryProfile(deliveryType).creditCalculationMode === 'MANUAL_OVERRIDE'
  );
}

/** Lab/practical fees when practical credits exist or lab is explicitly required. */
export function deriveHasPractical(
  _deliveryType: CourseDeliveryType,
  practicalCredits = 0,
  labRequired = false,
): boolean {
  return practicalCredits > 0 || labRequired;
}

export function formatDeliveryTypeLabel(
  deliveryType: string | null | undefined,
): string {
  if (!deliveryType) return 'Theory';
  const resolved = resolveDeliveryType(deliveryType) ?? deliveryType;
  if (isCourseDeliveryType(resolved)) return COURSE_DELIVERY_LABELS[resolved];
  return deliveryType;
}

export function normalizeCourseDeliveryInput(input: {
  deliveryType: CourseDeliveryType;
  theoryCredits?: number;
  practicalCredits?: number;
  theoryHoursPerWeek?: number;
  practicalHoursPerWeek?: number;
  credits?: number;
  creditCalculationMode?: CreditCalculationMode;
  totalContactHours?: number;
  totalTheoryContactHours?: number;
  totalPracticalContactHours?: number;
  labRequired?: boolean;
  attendanceMode?: AttendanceMode;
  requiresTimetableSlots?: boolean;
}) {
  const profile = getDeliveryProfile(input.deliveryType);
  const creditCalculationMode =
    input.creditCalculationMode ?? profile.creditCalculationMode;

  let theoryCredits = Math.max(0, input.theoryCredits ?? 0);
  let practicalCredits = Math.max(0, input.practicalCredits ?? 0);
  let theoryHours = Math.max(0, input.theoryHoursPerWeek ?? 0);
  let practicalHours = Math.max(0, input.practicalHoursPerWeek ?? 0);
  let totalTheoryContact = Math.max(0, input.totalTheoryContactHours ?? 0);
  let totalPracticalContact = Math.max(
    0,
    input.totalPracticalContactHours ?? 0,
  );
  let totalContactHours = Math.max(0, input.totalContactHours ?? 0);

  if (creditCalculationMode === 'MANUAL_OVERRIDE') {
    const credits = Math.max(0, input.credits ?? 0);
    if (!profile.requiresTheorySplit) {
      theoryCredits = 0;
      theoryHours = 0;
      totalTheoryContact = 0;
    }
    if (!profile.requiresPracticalSplit) {
      practicalCredits = 0;
      practicalHours = 0;
      totalPracticalContact = 0;
    }
    if (!profile.requiresSplitContactHours && totalContactHours === 0) {
      totalContactHours = totalTheoryContact + totalPracticalContact;
    }
    return {
      deliveryType: input.deliveryType,
      creditCalculationMode,
      requiresTheorySplit: profile.requiresTheorySplit,
      requiresPracticalSplit: profile.requiresPracticalSplit,
      hasPractical: deriveHasPractical(
        input.deliveryType,
        practicalCredits,
        input.labRequired ?? profile.defaultLabRequired,
      ),
      attendanceMode: input.attendanceMode ?? profile.defaultAttendanceMode,
      requiresTimetableSlots:
        input.requiresTimetableSlots ?? profile.defaultRequiresTimetableSlots,
      labRequired: input.labRequired ?? profile.defaultLabRequired,
      theoryCredits,
      practicalCredits,
      theoryHoursPerWeek: theoryHours,
      practicalHoursPerWeek: practicalHours,
      totalTheoryContactHours: totalTheoryContact,
      totalPracticalContactHours: totalPracticalContact,
      totalContactHours,
      credits,
    };
  }

  if (theoryCredits === 0 && practicalCredits === 0 && input.credits != null) {
    theoryCredits = Math.max(0, input.credits);
  }

  const credits =
    theoryCredits + practicalCredits > 0
      ? theoryCredits + practicalCredits
      : Math.max(0, input.credits ?? 0);

  totalContactHours =
    totalContactHours > 0
      ? totalContactHours
      : totalTheoryContact + totalPracticalContact;

  return {
    deliveryType: input.deliveryType,
    creditCalculationMode,
    requiresTheorySplit: profile.requiresTheorySplit,
    requiresPracticalSplit: profile.requiresPracticalSplit,
    hasPractical: deriveHasPractical(
      input.deliveryType,
      practicalCredits,
      input.labRequired ?? profile.defaultLabRequired,
    ),
    attendanceMode: input.attendanceMode ?? profile.defaultAttendanceMode,
    requiresTimetableSlots:
      input.requiresTimetableSlots ?? profile.defaultRequiresTimetableSlots,
    labRequired: input.labRequired ?? profile.defaultLabRequired,
    theoryCredits,
    practicalCredits,
    theoryHoursPerWeek: theoryHours,
    practicalHoursPerWeek: practicalHours,
    totalTheoryContactHours: totalTheoryContact,
    totalPracticalContactHours: totalPracticalContact,
    totalContactHours,
    credits,
  };
}
