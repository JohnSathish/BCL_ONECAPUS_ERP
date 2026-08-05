export type PrincipalMobileSummary = {
  greeting: {
    salutation: string;
    title: string;
    userName: string;
    dateLabel: string;
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
};
