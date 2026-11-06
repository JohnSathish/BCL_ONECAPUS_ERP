/**
 * Class XII subjects for board Others. Other boards keep their own CSV rows.
 * Commerce follows the Assam Higher Secondary marksheet.
 */
export const OTHERS_ARTS_SUBJECTS = [
  { subjectName: 'English', sortOrder: 10 },
  { subjectName: 'Hindi', sortOrder: 20 },
  { subjectName: 'Economics', sortOrder: 30 },
  { subjectName: 'Education', sortOrder: 40 },
  { subjectName: 'Geography', sortOrder: 50 },
  { subjectName: 'History', sortOrder: 60 },
  { subjectName: 'Political Science', sortOrder: 70 },
  { subjectName: 'Sociology', sortOrder: 80 },
  { subjectName: 'Logic and Philosophy', sortOrder: 90 },
] as const;

export const OTHERS_SCIENCE_SUBJECTS = [
  { subjectName: 'English', sortOrder: 10 },
  { subjectName: 'Hindi', sortOrder: 20 },
] as const;

export const OTHERS_COMMERCE_SUBJECTS = [
  { subjectName: 'English', sortOrder: 10 },
  { subjectName: 'MIL (Garo)', sortOrder: 20 },
  { subjectName: 'Business Studies', sortOrder: 30 },
  { subjectName: 'Finance', sortOrder: 40 },
  { subjectName: 'Economics', sortOrder: 50 },
  { subjectName: 'Accountancy', sortOrder: 60 },
  { subjectName: 'Hindi', sortOrder: 70 },
] as const;

export function othersSubjectsForStream(streamCode: string) {
  if (streamCode === 'COMMERCE') return OTHERS_COMMERCE_SUBJECTS;
  if (streamCode === 'ARTS') return OTHERS_ARTS_SUBJECTS;
  if (streamCode === 'SCIENCE') return OTHERS_SCIENCE_SUBJECTS;
  return OTHERS_SCIENCE_SUBJECTS;
}
