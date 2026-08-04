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
  };
  overview: {
    studentsPresent: number;
    studentsAbsent: number;
    staffPresent: number;
    staffAbsent: number;
    admissionsToday: number;
    feeCollectionToday: number;
    pendingApprovals: number;
    unreadEmails: number;
    attendancePct: number | null;
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
  }>;
  schedule: Array<{
    dayGroup: string;
    time: string;
    label: string;
    href: string;
  }>;
  quickActions: Array<{ id: string; label: string; href: string }>;
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
