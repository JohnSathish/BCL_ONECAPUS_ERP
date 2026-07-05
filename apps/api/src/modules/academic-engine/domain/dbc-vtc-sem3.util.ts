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
    ...NEHU_VTC_CREDIT_PROFILE,
  };
}

export function buildNehuSem3VtcCourse(
  code: string,
  title: string,
): ArtsFyugpCourseDef {
  return buildNehuVtcCourse(code, title, 3);
}
