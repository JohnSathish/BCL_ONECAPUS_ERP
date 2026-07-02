export type AcademicChip = {
  category: string;
  label: string;
  courseTitle: string;
};

export type AcademicSubjectCard = {
  id: string;
  category: string;
  categoryLabel: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  facultyName: string | null;
  room: string | null;
  attendancePercent: number | null;
  internalMarks: { obtained: number; max: number } | null;
  assignmentStatus: string | null;
  offeringId: string;
  offeringSectionId: string | null;
};

export type StudentAcademicsPayload = {
  header: {
    academicYear: string | null;
    programme: string;
    semesterSequence: number | null;
    semesterLabel: string;
    shift: string | null;
    department: string;
    registrationStatus: string;
    registrationComplete: boolean;
    totalCredits: number;
    targetCredits: number;
    curriculumVersion: string | null;
    status: string;
    major: string | null;
    minor: string | null;
  };
  snapshot: AcademicChip[];
  subjects: AcademicSubjectCard[];
  attendanceBySubject: {
    label: string;
    percentage: number;
    presentCount: number;
    totalSessions: number;
  }[];
  todayClasses: {
    time: string;
    title: string;
    room: string | null;
    isCurrent: boolean;
  }[];
  weeklyTimetable: {
    day: string;
    dayOfWeek: number;
    slots: { time: string; title: string; room: string | null }[];
  }[];
  semesterProgress: {
    category: string;
    label: string;
    registered: boolean;
    credits: number;
  }[];
  journey: {
    semesterSequence: number;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
    registrationStatus: string | null;
    subjectCount: number;
    credits: number;
  }[];
  internalMarks: {
    label: string;
    category: string;
    obtained: number;
    max: number;
  }[];
  assignmentsDue: number;
  downloads: {
    syllabusAvailable: boolean;
    curriculumAvailable: boolean;
    subjectListAvailable: boolean;
  };
};
