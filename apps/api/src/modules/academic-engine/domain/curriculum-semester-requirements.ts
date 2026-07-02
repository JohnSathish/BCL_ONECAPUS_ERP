/** FYUGP semester curriculum requirements for admin status checks. */

export type SemesterCurriculumMode = 'shift-pools' | 'direct-offerings';

export function semesterCurriculumMode(
  semesterNo: number,
): SemesterCurriculumMode {
  if (semesterNo === 1 || semesterNo === 2 || semesterNo === 3) {
    return 'shift-pools';
  }
  return 'direct-offerings';
}

/** Categories required for a semester to be considered configured. */
export function requiredSemesterCategories(semesterNo: number): string[] {
  switch (semesterNo) {
    case 1:
    case 2:
      return ['MDC', 'AEC', 'SEC', 'VAC'];
    case 3:
      return ['MDC', 'AEC', 'SEC', 'VTC'];
    case 4:
      return ['MAJOR', 'VTC'];
    case 5:
      return ['MAJOR', 'MINOR', 'INTERNSHIP'];
    case 6:
      return ['MAJOR', 'VTC'];
    default:
      return [];
  }
}

/** Minimum direct offering counts per category (Sem 4–8 programme mappings). */
export function minimumDirectOfferingCounts(
  semesterNo: number,
): Record<string, number> {
  switch (semesterNo) {
    case 4:
      return { MAJOR: 1, VTC: 1 };
    case 5:
      return { MAJOR: 3, MINOR: 1, INTERNSHIP: 1 };
    case 6:
      return { MAJOR: 4, VTC: 1 };
    default:
      return {};
  }
}
