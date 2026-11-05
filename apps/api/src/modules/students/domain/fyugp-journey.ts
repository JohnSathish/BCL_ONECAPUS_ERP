/** FYUGP students normally finish at semester 6. Semesters 7 and 8 stay in the programme for readmission. */
export const FYUGP_CORE_SEMESTERS = 6;

export type FyugpJourneyStatus = 'completed' | 'current' | 'upcoming';
export type FyugpReadmissionStatus =
  | 'NONE'
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED';

export type FyugpJourneySemester = {
  semesterSequence: number;
  label: string;
  status: FyugpJourneyStatus;
  registrationStatus: string | null;
  subjectCount: number;
  credits: number;
};

export type FyugpJourneyRegistration = {
  sequence: number | null;
  status: string | null;
  subjectCount: number;
  credits: number;
};

const COMPLETED_REGISTRATION = new Set([
  'submitted',
  'approved',
  'completed',
  'confirmed',
]);

export function buildFyugpStudentJourney(input: {
  totalSemesters: number;
  currentSemester: number | null;
  registrations: FyugpJourneyRegistration[];
  progressCompletedSequences?: number[];
  readmissionStatus?: FyugpReadmissionStatus;
}) {
  const current = input.currentSemester ?? 1;
  const completed = new Set<number>(input.progressCompletedSequences ?? []);
  for (const registration of input.registrations) {
    const sequence = registration.sequence;
    if (sequence == null) continue;
    if (
      COMPLETED_REGISTRATION.has(
        String(registration.status ?? '').toLowerCase(),
      )
    ) {
      completed.add(sequence);
    }
  }

  const structureMax = Math.max(input.totalSemesters || 8, 8);
  const readmissionStatus = input.readmissionStatus ?? 'NONE';
  const hasLaterRegistration = input.registrations.some(
    (registration) =>
      (registration.sequence ?? 0) >= 7 && registration.subjectCount > 0,
  );
  const continuing =
    current >= 7 || readmissionStatus === 'APPROVED' || hasLaterRegistration;
  const visibleMax = continuing
    ? Math.max(8, Math.min(structureMax, Math.max(8, current)))
    : FYUGP_CORE_SEMESTERS;

  const journey: FyugpJourneySemester[] = [];
  for (let semester = 1; semester <= visibleMax; semester += 1) {
    const registration = input.registrations.find(
      (row) => row.sequence === semester,
    );
    let status: FyugpJourneyStatus = 'upcoming';
    if (semester < current || completed.has(semester)) status = 'completed';
    else if (semester === current) status = 'current';
    journey.push({
      semesterSequence: semester,
      label: `Semester ${semester}`,
      status,
      registrationStatus: registration?.status ?? null,
      subjectCount: registration?.subjectCount ?? 0,
      credits: registration?.credits ?? 0,
    });
  }

  const activelyInSemester6 = current === 6 && !completed.has(6);
  const sixSemesterCompleted =
    (completed.has(6) || current > 6) && !activelyInSemester6;
  const showExit = sixSemesterCompleted && !continuing;

  return {
    journey,
    programmeCompletion: showExit
      ? {
          title: 'Six-Semester Programme Completed',
          message:
            'Congratulations! You have completed your six-semester undergraduate programme. If you wish to continue Semesters 7 and 8 at Don Bosco College, you may apply for readmission.',
        }
      : null,
    continuation: showExit
      ? {
          title: 'Continue to Semesters 7 & 8',
          message:
            'Students interested in continuing the FYUGP programme for Semesters 7 and 8 at Don Bosco College may apply for readmission.',
          canApply:
            readmissionStatus === 'NONE' || readmissionStatus === 'DECLINED',
          status: readmissionStatus,
        }
      : null,
  };
}
