export type FacultyTodayClass = {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
  semesterNo: number | null;
  sectionCode: string | null;
  classroom: string | null;
  shiftName?: string | null;
  offeringSectionId?: string | null;
  status?: string;
};

export type FacultyPendingAction = {
  id: string;
  tone: 'urgent' | 'warning' | 'pending' | 'info' | 'success';
  label: string;
  count: number;
};

export type FacultyHomeSnapshot = {
  profile?: {
    staffId?: string;
    fullName?: string;
    employeeCode?: string;
    photoUrl?: string | null;
    department?: string | null;
    designation?: string | null;
    greeting?: string;
    email?: string | null;
    mobile?: string | null;
    experienceYears?: number | null;
    joiningDate?: string | null;
    qualification?: string | null;
    specialization?: string | null;
    publicEmail?: string | null;
    publicPhone?: string | null;
    officeLocation?: string | null;
    googleScholarUrl?: string | null;
    orcidUrl?: string | null;
    researchAreas?: string | null;
    addressJson?: Record<string, string> | null;
    emergencyContactJson?: Record<string, string> | null;
    bloodGroup?: string | null;
    profileCompletion?: number;
    isTeaching?: boolean;
    isHod?: boolean;
    additionalRoles?: { code: string; label: string }[];
  };
  academicContext?: {
    session?: string | null;
    cycle?: string;
    activeSemesters?: number[];
  };
  todayClasses?: FacultyTodayClass[];
  workloadSummary?: {
    classesToday?: number;
    attendancePending?: number;
    marksPending?: number;
    lessonPlansPending?: number;
    assignmentsPending?: number;
    meetingsUpcoming?: number;
  };
  pendingActions?: FacultyPendingAction[];
  myClasses?: {
    id: string;
    courseTitle: string;
    courseCode?: string;
    semesterNo?: number;
    sectionCode?: string;
    offeringSectionId?: string | null;
    studentCount?: number;
    weeklyHours?: number;
    canMarkAttendance?: boolean;
    canEnterInternalMarks?: boolean;
  }[];
  analytics?: {
    staffAttendancePercent?: number | null;
    attendanceSubmittedPercent?: number | null;
    studentsTaught?: number;
    assignedSubjects?: number;
  };
  notifications?: {
    id: string;
    type?: string;
    title: string;
    body?: string;
    createdAt?: string;
    read?: boolean;
  }[];
  departmentNotices?: { id: string; title: string; body?: string }[];
  unreadNotificationCount?: number;
  leaveBalance?: { casual?: number; sick?: number; earned?: number };
  payroll?: {
    amount?: number;
    currency?: string;
    status?: string;
    payslipAvailable?: boolean;
    lastPaymentDate?: string | null;
  };
  performance?: {
    classesThisWeek?: number;
    attendanceSubmittedPercent?: number;
    assignedSubjects?: number;
    studentsTaught?: number;
  };
  calendarEvents?: { id: string; date: string; type?: string; title: string; subtitle?: string }[];
  teachingLoad?: {
    assignedSubjects?: number;
    sections?: number;
    weeklyClasses?: number;
    credits?: number;
  };
};
