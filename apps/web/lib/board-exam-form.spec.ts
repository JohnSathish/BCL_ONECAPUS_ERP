import {
  emptyBoardExamSubjectRows,
  isPlaceholderBoardSubjectName,
  sanitizeBoardExamPayload,
} from './board-exam-form';

describe('board-exam-form', () => {
  it('detects placeholder subject rows', () => {
    expect(isPlaceholderBoardSubjectName('Subject 1')).toBe(true);
    expect(isPlaceholderBoardSubjectName('Geography')).toBe(false);
  });

  it('drops placeholder rows before save', () => {
    const payload = sanitizeBoardExamPayload({
      boardName: 'MBOSE',
      schoolName: 'Test School',
      boardRollNumber: '',
      stream: '',
      registrationType: '',
      division: '',
      subjectMarks: [
        { subjectName: 'Subject 1' },
        { subjectName: 'Geography', marksObtained: 80, maxMarks: 100 },
      ],
    });
    expect(payload.subjectMarks).toEqual([
      { subjectName: 'Geography', marksObtained: 80, maxMarks: 100 },
    ]);
  });

  it('omits subjectMarks when all rows are empty', () => {
    const payload = sanitizeBoardExamPayload({
      boardName: '',
      schoolName: '',
      boardRollNumber: '',
      stream: '',
      registrationType: '',
      division: '',
      subjectMarks: emptyBoardExamSubjectRows(3),
    });
    expect(payload.subjectMarks).toBeUndefined();
  });
});
