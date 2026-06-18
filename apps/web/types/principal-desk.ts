export type PrincipalDeskSnapshot = {
  totalStudents: number;
  studentsPresentToday: number;
  studentsAbsentToday: number;
  staffPresentToday: number;
  staffAbsentToday: number;
  classesConductedToday: number;
  feeDefaulters: number;
  libraryOverdueStudents: number;
  leaveRequestsPending: number;
  pendingStaffLeave: number;
  pendingStudentLeave: number;
  upcomingEvents: number;
};

export type PrincipalCriticalAlerts = {
  attendanceRisk: { count: number; label: string; href: string };
  feeDefaulters: { count: number; amount: number; href: string };
  libraryOverdue: { count: number; books: number; href: string };
  leavePending: { count: number; href: string };
  committeeMeetingsToday: { count: number; href: string };
  staffAbsentToday: { count: number; href: string };
};

export type PrincipalDeskDashboard = {
  greeting: { userName: string; dateLabel: string; dayLabel: string };
  updatedAt: string;
  institution: {
    academicYear: string;
    semester: string;
    activeSemesters: number[];
    cycle: string | null;
    studentCount: number;
    staffCount: number;
  };
  snapshot: PrincipalDeskSnapshot;
  pulse: {
    urgentActions: number;
    attendanceTodayPct: number;
    collectionRate: number;
    pendingDues: number;
  };
  academic: {
    studentAttendancePct: number;
    facultyAttendancePct: number;
    classesScheduled: number;
    classesCompleted: number;
    classesPending: number;
    facultyPresent: number;
    facultyAbsent: number;
    studentsPresent: number;
    studentsAbsent: number;
    dataSource?: 'live' | 'estimated';
  };
  finance: {
    pendingDues: number;
    defaulters: number;
    todayCollection: number;
    monthCollection: number;
    collectionRate?: number;
  };
  actions: Array<{
    id: string;
    message: string;
    href: string;
    priority: string;
    count?: number;
  }>;
  upcomingEvents: Array<{ date: string; label: string; href?: string }>;
  eventTimeline: Array<{
    dayGroup: string;
    time: string;
    label: string;
    href?: string;
  }>;
  announcements: Array<{ title: string; date: string; href?: string }>;
  aiInsights: string[];
  intelligenceSummary: {
    salutation: string;
    bullets: string[];
  };
  criticalAlerts: PrincipalCriticalAlerts;
  operations: {
    library: { issuedToday: number; returnsToday: number; overdueBooks: number };
    activeOnCampus: number;
    studentPresentPct: number;
    facultyPresentPct: number;
  };
  campusHealth: {
    score: number;
    band: 'green' | 'orange' | 'red';
    factors: {
      attendance: number;
      fees: number;
      library: number;
      staff: number;
    };
  };
  committeeActivity: Array<{
    id: string;
    name: string;
    pending: number;
    href: string;
  }>;
  alerts: {
    committeePendingAtr: number;
    committeeOverdueAtr: number;
    naacReadiness: number | null;
    naacAqarStatus: string | null;
    scheduledMeetings: number;
    openTasks: number;
  };
};

export type StudentCommandCard = {
  studentId: string;
  basic: {
    photoUrl?: string | null;
    fullName: string;
    enrollmentNumber: string;
    rollNumber?: string | null;
    abcId?: string | null;
    rfidNumber?: string | null;
    mobile?: string | null;
    email?: string | null;
  };
  academic: {
    programme?: string | null;
    department?: string | null;
    semester?: number | null;
    batch?: string | null;
    majorSubject?: string | null;
    status: string;
    statusLabel: string;
  };
  attendance: {
    percentage: number | null;
    band: 'green' | 'orange' | 'red' | 'neutral';
    classesAttended: number;
    classesConducted: number;
  };
  admitCard: {
    eligible: boolean;
    reasons: string[];
    attendancePercent: number | null;
    outstandingAmount: number;
  };
  fees: {
    admissionFeeStatus?: unknown;
    monthlyFeeStatus?: unknown;
    monthlyTracker?: Array<{ month: string; status: string; amount?: number }>;
    outstandingAmount: number;
  };
  library: {
    booksIssued: number;
    booksReturned: number;
    booksCurrentlyHeld: number;
    dueBooks: number;
    fineAmount: number;
  };
  examination: {
    internalMarksRecorded: number;
    assignmentsPending: number;
    examinationEligible: boolean;
    backlogs: number;
  };
  disciplinary: Array<{ id: string; type: string; body: string; createdAt: string }>;
  hostel: {
    isHosteller: boolean;
    block?: string | null;
    room?: string | null;
    warden?: string | null;
  };
  timeline: Array<{ at: string; label: string; category: string; dayLabel: string }>;
  scannedAt: string;
};

export type StaffCommandCard = {
  staffProfileId: string;
  profile: {
    photoUrl?: string | null;
    fullName: string;
    employeeCode: string;
    department?: string | null;
    designation?: string | null;
    joiningDate?: string | null;
    staffType: string;
    status: string;
  };
  attendanceSummary: {
    presentDays: number;
    absentDays: number;
    lateArrivals: number;
    earlyExits: number;
    workingHours: number;
    monthLabel: string;
  };
  todaySchedule: Array<{
    period: number;
    subject: string;
    room?: string | null;
    startTime: string;
    endTime: string;
    sectionCode?: string | null;
  }>;
  leave: {
    pending: unknown[];
    approved: unknown[];
    rejected: unknown[];
  };
  committees: Array<{
    id: string;
    committeeName?: string;
    role?: string;
    memberType?: string;
    status?: string;
  }>;
  scannedAt: string;
};

export type InstitutionalHealth = {
  students: { total: number; active: number; dropouts: number; transfers: number };
  staff: { teaching: number; nonTeaching: number; vacancies: number };
  finance: { collection: number; outstanding: number; scholarships: number; concessions: number };
  library: { booksIssued: number; overdueBooks: number; fineCollection: number };
  updatedAt: string;
};
