export type BoardExamSubjectMarkForm = {
  subjectName: string;
  marksObtained?: number;
  maxMarks?: number;
};

export type BoardExamFormValues = {
  boardName: string;
  schoolName: string;
  boardRollNumber: string;
  examYear?: number;
  stream: string;
  registrationType: string;
  division: string;
  subjectMarks: BoardExamSubjectMarkForm[];
};

export function isPlaceholderBoardSubjectName(name: string): boolean {
  const trimmed = name.trim();
  return !trimmed || /^Subject \d+$/i.test(trimmed);
}

/** Strip placeholder rows before autosave/API — avoids 400 on unknown board subjects. */
export function sanitizeBoardExamPayload<T extends BoardExamFormValues>(form: T) {
  const subjectMarks = form.subjectMarks.filter(
    (mark) => !isPlaceholderBoardSubjectName(mark.subjectName),
  );
  return {
    ...form,
    subjectMarks: subjectMarks.length > 0 ? subjectMarks : undefined,
  };
}

export function emptyBoardExamSubjectRows(count = 5): BoardExamSubjectMarkForm[] {
  return Array.from({ length: count }, () => ({
    subjectName: '',
    marksObtained: undefined,
    maxMarks: undefined,
  }));
}
