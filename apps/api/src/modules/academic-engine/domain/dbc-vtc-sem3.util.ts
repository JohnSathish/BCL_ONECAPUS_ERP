import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

/** NEHU FYUGP VTC (Sem 3+): 4 credits, 1 theory + 3 practical per week (105 contact hours). */
export const NEHU_VTC_CREDIT_PROFILE = {
  credits: 4,
  deliveryType: 'THEORY_PRACTICAL' as const,
  creditCalculationMode: 'AUTO_CALCULATED' as const,
  theoryCredits: 1,
  practicalCredits: 3,
  theoryHoursPerWeek: 1,
  practicalHoursPerWeek: 3,
  totalTheoryContactHours: 15,
  totalPracticalContactHours: 90,
  totalContactHours: 105,
};

/** @deprecated use NEHU_VTC_CREDIT_PROFILE */
export const NEHU_VTC_SEM3_CREDIT_PROFILE = NEHU_VTC_CREDIT_PROFILE;

/**
 * Stable vocational-track group for every VTC course code across Sem 3/4/6.
 * Continuity (e.g. Desktop Publishing I -> II -> III) matches on this group,
 * NOT on the numeric code (the numbers differ per stage, e.g. Photography is
 * 248.1 -> 269.1 -> 369.1). Keep this in sync with the DB track-group tags.
 */
export const VTC_TRACK_GROUP_BY_CODE: Record<string, string> = {
  'VTC-240.3': 'BEE_KEEPING',
  'VTC-260.3': 'BEE_KEEPING',
  'VTC-360.3': 'BEE_KEEPING',
  'VTC-241.2': 'MUSHROOM_CULTIVATION',
  'VTC-261.2': 'MUSHROOM_CULTIVATION',
  'VTC-361.2': 'MUSHROOM_CULTIVATION',
  'VTC-242.2': 'ELECTRICAL',
  'VTC-262.2': 'ELECTRICAL',
  'VTC-362.2': 'ELECTRICAL',
  'VTC-243.1': 'WEB_DESIGNING',
  'VTC-263.1': 'WEB_DESIGNING',
  'VTC-363.1': 'WEB_DESIGNING',
  'VTC-243.2': 'DESKTOP_PUBLISHING',
  'VTC-263.2': 'DESKTOP_PUBLISHING',
  'VTC-363.2': 'DESKTOP_PUBLISHING',
  'VTC-243.3': 'COMPUTERIZED_ACCOUNTING',
  'VTC-263.3': 'COMPUTERIZED_ACCOUNTING',
  'VTC-363.3': 'COMPUTERIZED_ACCOUNTING',
  'VTC-244.2': 'EVENT_MANAGEMENT',
  'VTC-264.2': 'EVENT_MANAGEMENT',
  'VTC-364.2': 'EVENT_MANAGEMENT',
  'VTC-245.3': 'GUITAR',
  'VTC-265.3': 'GUITAR',
  'VTC-365.3': 'GUITAR',
  'VTC-245.4': 'VOCALS',
  'VTC-265.4': 'VOCALS',
  'VTC-365.4': 'VOCALS',
  // Traditional Music / Beauty Care exist only as Sem-3 (Stage-I); the college
  // does not offer their Stage-II (Sem 4), so there is no VTC-265.5 / VTC-267.1.
  'VTC-245.5': 'TRADITIONAL_MUSIC',
  'VTC-246.1': 'BAKING_CONFECTIONERY',
  'VTC-266.1': 'BAKING_CONFECTIONERY',
  'VTC-366.1': 'BAKING_CONFECTIONERY',
  'VTC-247.1': 'BEAUTY_CARE',
  'VTC-248.1': 'PHOTOGRAPHY',
  'VTC-269.1': 'PHOTOGRAPHY',
  'VTC-369.1': 'PHOTOGRAPHY',
};

function vtcStageForSemester(semesterSequence: number): number | undefined {
  if (semesterSequence === 3) return 1;
  if (semesterSequence === 4) return 2;
  if (semesterSequence === 6) return 3;
  return undefined;
}

export function buildNehuVtcCourse(
  code: string,
  title: string,
  semesterSequence: number,
): ArtsFyugpCourseDef {
  return {
    code,
    title,
    category: 'VTC',
    semesterSequence,
    departmentCode: 'ENG',
    subjectSlug: 'vtc',
    sharedPool: true,
    vtcTrackGroupCode: VTC_TRACK_GROUP_BY_CODE[code],
    vtcTrackStage: vtcStageForSemester(semesterSequence),
    ...NEHU_VTC_CREDIT_PROFILE,
  };
}

export function buildNehuSem3VtcCourse(
  code: string,
  title: string,
): ArtsFyugpCourseDef {
  return buildNehuVtcCourse(code, title, 3);
}
