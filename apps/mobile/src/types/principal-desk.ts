export type PrincipalMobileSummary = {
  greeting: {
    salutation: string;
    title: string;
    userName: string;
    dateLabel: string;
    photoUrl?: string | null;
  };
  institution: {
    academicYear: string | null;
    semester: string | null;
    studentCount: number;
    staffCount: number;
    name?: string | null;
  };
  overview: {
    studentsPresent: number;
    studentsAbsent: number;
    staffPresent: number;
    staffAbsent: number;
    admissionsToday: number;
    feeCollectionToday: number;
    feeCollectionMonth?: number;
    pendingApprovals: number;
    unreadEmails: number;
    attendancePct: number | null;
    studentsAttendancePct?: number | null;
    staffAttendancePct?: number | null;
    classesToday?: number;
    departmentCount?: number;
    programCount?: number;
    subjectCount?: number;
    semestersRunning?: number;
    shiftCount?: number;
    feeTrendPct?: number | null;
    notificationCount?: number;
  };
  mail: {
    connected: boolean;
    unread: number;
    today: number;
    googleEmail: string | null;
  };
  alerts: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    href: string;
    count?: number;
    actionHint?: string;
  }>;
  schedule: Array<{
    dayGroup: string;
    time: string;
    label: string;
    href: string;
  }>;
  notices?: Array<{
    id: string;
    title: string;
    dateLabel: string;
    tag?: string;
    href?: string;
  }>;
  quickActions: Array<{ id: string; label: string; href: string; icon?: string }>;
  intelligence: { bullets: string[] };
  campusHealth: {
    score: number;
    band: 'green' | 'orange' | 'red';
  } | null;
  updatedAt: string;
};

export type PrincipalLeaveQueue = {
  staff: Array<{
    id: string;
    status: string;
    fromDate?: string;
    toDate?: string;
    reason?: string | null;
    leaveType?: { name?: string } | null;
    staffProfile?: { fullName?: string; employeeCode?: string } | null;
  }>;
  student: Array<{
    id: string;
    status: string;
    fromDate?: string;
    toDate?: string;
    reason?: string | null;
    student?: { fullName?: string; enrollmentNumber?: string } | null;
  }>;
  total: number;
};

export type PrincipalMailListItem = {
  id: string;
  subject: string;
  snippet: string;
  fromAddress: string;
  fromName?: string | null;
  receivedAt: string;
  starred: boolean;
  isRead: boolean;
  hasAttachment: boolean;
  folder: string;
};

export type PrincipalMailMessage = PrincipalMailListItem & {
  toAddresses: string[];
  ccAddresses: string[];
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments?: Array<{
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  account?: { id: string; googleEmail: string };
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
  hostel: {
    isHosteller: boolean;
    block?: string | null;
    room?: string | null;
    warden?: string | null;
  };
  scannedAt: string;
};
