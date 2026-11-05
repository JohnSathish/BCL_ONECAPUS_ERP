import { buildFyugpStudentJourney } from './fyugp-journey';

const registration = (
  sequence: number,
  status: string,
  subjectCount = 0,
  credits = 0,
) => ({ sequence, status, subjectCount, credits });

describe('FYUGP student journey', () => {
  it('shows semesters 1 to 6 and hides 7 and 8 while the student is still in the core programme', () => {
    const result = buildFyugpStudentJourney({
      totalSemesters: 8,
      currentSemester: 5,
      registrations: [
        registration(1, 'approved'),
        registration(2, 'approved'),
        registration(3, 'approved'),
        registration(4, 'approved'),
        registration(5, 'approved', 5, 20),
      ],
    });

    expect(result.journey.map((row) => row.semesterSequence)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(
      result.journey.find((row) => row.semesterSequence === 6)?.status,
    ).toBe('upcoming');
    expect(result.programmeCompletion).toBeNull();
    expect(result.continuation).toBeNull();
  });

  it('offers readmission after semester 6 without marking the student discontinued', () => {
    const result = buildFyugpStudentJourney({
      totalSemesters: 8,
      currentSemester: 6,
      registrations: [registration(6, 'completed', 5, 20)],
      progressCompletedSequences: [6],
    });

    expect(result.journey.some((row) => row.semesterSequence > 6)).toBe(false);
    expect(result.programmeCompletion?.title).toBe(
      'Six-Semester Programme Completed',
    );
    expect(result.continuation?.canApply).toBe(true);
    expect(result.continuation?.status).toBe('NONE');
  });

  it('shows semesters 7 and 8 after readmission is approved', () => {
    const result = buildFyugpStudentJourney({
      totalSemesters: 8,
      currentSemester: 7,
      registrations: [registration(6, 'completed', 5, 20)],
      readmissionStatus: 'APPROVED',
    });

    expect(result.journey.map((row) => row.semesterSequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      result.journey.find((row) => row.semesterSequence === 7)?.status,
    ).toBe('current');
    expect(result.programmeCompletion).toBeNull();
    expect(result.continuation).toBeNull();
  });
});
