export type AcademicCycle = 'ODD' | 'EVEN';

export const ODD_SEMESTER_NUMBERS = [1, 3, 5, 7] as const;
export const EVEN_SEMESTER_NUMBERS = [2, 4, 6, 8] as const;
export const MAX_FYUGP_SEMESTER = 8;

export function cycleTypeFromSemesterNumber(
  semesterNumber: number,
): AcademicCycle {
  return semesterNumber % 2 === 1 ? 'ODD' : 'EVEN';
}

export function semesterNumbersForCycle(cycle: AcademicCycle): number[] {
  return cycle === 'ODD'
    ? [...ODD_SEMESTER_NUMBERS]
    : [...EVEN_SEMESTER_NUMBERS];
}

export function oppositeCycle(cycle: AcademicCycle): AcademicCycle {
  return cycle === 'ODD' ? 'EVEN' : 'ODD';
}

export function assertFyugpSemesterNumber(semesterNumber: number): void {
  if (semesterNumber < 1 || semesterNumber > MAX_FYUGP_SEMESTER) {
    throw new Error(`FYUGP supports semesters 1–${MAX_FYUGP_SEMESTER} only`);
  }
}
