export type LibraryMemberType = 'STUDENT' | 'STAFF' | 'FACULTY' | 'VISITOR';

export type LibraryMemberProfile = {
  memberType: LibraryMemberType;
  memberId: string;
  studentId?: string;
  staffProfileId?: string;
  visitorId?: string;
  fullName: string;
  photoUrl?: string | null;
  registrationNumber?: string;
  department?: string | null;
  programme?: string | null;
  semester?: number | null;
  gender?: string | null;
  academicYear?: string | null;
  designation?: string | null;
  status: string;
  active: boolean;
};

export type OccupancySnapshot = {
  studentsInside: number;
  maleStudents: number;
  femaleStudents: number;
  facultyInside: number;
  staffInside: number;
  visitorsInside: number;
  totalInside: number;
  availableSeats: number;
  totalSeats: number;
  occupancyPercent: number;
  hourlyFootfall: { hour: number; count: number }[];
  maleStaffInside?: number;
  femaleStaffInside?: number;
};

export type ScanResult = {
  action: 'ENTRY' | 'EXIT';
  profile: LibraryMemberProfile;
  visit: {
    id: string;
    entryAt: string;
    exitAt?: string | null;
    durationMinutes?: number | null;
    zoneId?: string | null;
    seatLabel?: string | null;
    entryMethod?: string | null;
  };
  occupancy: OccupancySnapshot;
  zone?: { id: string; name: string; code: string; seatLabel?: string | null } | null;
  deskContext?: {
    mobile?: string | null;
    rfidNumber?: string | null;
    abcId?: string | null;
    activeLoans?: number;
    unpaidFines?: number;
    membershipStatus?: string;
    attendancePercent?: number | null;
    feeStatus?: string | null;
  } | null;
};

export type LibraryAccessDeskDashboard = {
  stats: {
    entriesToday: number;
    exitsToday: number;
    currentlyInside: number;
    visitorsToday: number;
    avgStayMinutes: number;
    scansToday: number;
    booksIssuedToday?: number;
    booksReturnedToday?: number;
    peakHour?: number | null;
  };
  occupancy: OccupancySnapshot;
  visitorSummary: {
    maleStudents: number;
    femaleStudents: number;
    staffTeaching: number;
    staffNonTeaching: number;
    guestVisitors: number;
    totalFootfall: number;
  };
  departmentInside?: Array<{ name: string; count: number }>;
  recentActivity: Array<{
    at: string;
    action: 'IN' | 'OUT';
    memberName: string;
    department: string | null;
    memberType: string;
    photoUrl: string | null;
  }>;
  alerts: Array<{
    id: string;
    level: 'warn' | 'info';
    message: string;
    href?: string;
  }>;
};

export type LibraryDashboard = {
  occupancy: OccupancySnapshot;
  todayVisitors: number;
  weekVisitors: number;
  activeLoans: number;
  overdueLoans: number;
  totalBooks: number;
  totalTitles?: number;
  availableCopies: number;
  issuedToday?: number;
  returnedToday?: number;
  digitalViewsToday?: number;
  fineCollectedToday?: number;
  digitalAssets?: number;
  researchItems?: number;
  unpaidFinesCount?: number;
  unpaidFinesTotal?: number;
  footfallTrends?: {
    weekly: { date: string; count: number }[];
    monthly: { week: number; count: number }[];
    studentVsStaff: { students: number; staff: number };
  };
  departmentHeatmap?: {
    from: string;
    rows: { departmentName: string; visits: number; intensity: number }[];
  };
  genderTrends?: {
    from: string;
    weekly: { week: number; male: number; female: number; total: number }[];
  };
  healthScore?: LibraryHealthScore;
  activity?: LibraryActivityItem[];
  entryAnalytics?: LibraryEntryAnalytics;
};

export type LibraryHealthScore = {
  overall: number;
  usage: number;
  circulation: number;
  digital: number;
  overdueControl: number;
  engagement: number;
  entryAnalytics: boolean;
};

export type LibraryActivityItem = {
  at: string;
  action: 'ISSUE' | 'RETURN' | 'RENEW' | string;
  memberName: string;
  bookTitle: string;
  programme?: string | null;
};

export type LibraryEntryAnalytics = {
  active: boolean;
  male: number;
  female: number;
  staff: number;
  guests: number;
  total: number;
};

export type MemberRolePolicy = {
  loanDays: number;
  maxBooks: number;
  maxRenewals: number;
};

export type CategoryRulePolicy = {
  loanDays: number;
  maxBooks: number;
  allowIssue: boolean;
  requireApproval?: boolean;
};

export type CirculationPolicy = {
  student: MemberRolePolicy;
  faculty: MemberRolePolicy;
  researchScholar: MemberRolePolicy;
  staff: MemberRolePolicy;
  reference: CategoryRulePolicy;
  rare: CategoryRulePolicy;
};

export type FinePolicy = {
  lostBookPenaltyMultiplier: number;
  damageChargeDefault: number;
};

export type LibraryMemberSummary = {
  profile: LibraryMemberProfile;
  activeLoans: LibraryLoan[];
  borrowedCount: number;
  maxBooks: number;
  outstandingFine: number;
  lastVisitAt: string | null;
  visitCount: number;
  readingScore: number;
  membershipStatus: string;
};

export type LibraryBookPreview = {
  copy: {
    id: string;
    barcode: string;
    status: string;
    copyNumber: number;
  };
  book: {
    id: string;
    title: string;
    author?: string | null;
    publisher?: string | null;
    edition?: string | null;
    accessionNo: string;
    category?: string | null;
    location: string;
    section?: string | null;
    rack?: string | null;
    shelf?: string | null;
  };
  availableCopies: number;
  totalCopies: number;
  suggestedLoanDays: number;
};

export type LibraryIssuePreview = {
  dueAt: string;
  loanDays: number;
  finePerDay: number;
  graceDays: number;
  bookTitle: string;
};

export type LibraryCirculationDeskContext = {
  stats: {
    issuedToday: number;
    returnedToday: number;
    renewalsToday: number;
    overdueLoans: number;
    fineCollectedToday: number;
  };
  rules: {
    studentMaxBooks: number;
    facultyMaxBooks: number;
    staffMaxBooks: number;
    studentLoanDays: number;
    facultyLoanDays: number;
    studentMaxRenewals: number;
    facultyMaxRenewals: number;
    finePerDay: number;
    graceDays: number;
    maxFine: number;
    blockIssueOnUnpaidFines: boolean;
  };
  fineSummary: {
    pending: number;
    paidTotal: number;
    waivedTotal: number;
    collectedToday: number;
  };
};

export type LibraryReturnPreview = {
  loan: {
    id: string;
    issuedAt: string;
    dueAt: string;
    renewalCount: number;
  };
  book: {
    title: string;
    author?: string | null;
    accessionNo: string;
    barcode: string;
    location: string;
  };
  member: LibraryMemberProfile | null;
  returnedAt: string;
  overdueDays: number;
  projectedFine: number;
  existingFineId: string | null;
  existingFineAmount: number;
  finePerDay: number;
  graceDays: number;
};

export type LibraryRenewPreview = {
  bookTitle: string;
  barcode: string;
  currentDueAt: string;
  renewalCount: number;
  maxRenewals: number;
  newDueAt: string;
  loanDays: number;
  canRenew: boolean;
  blockReason: string | null;
};

export type LibraryCopyQr = {
  payload: string;
  barcode: string;
  qrImageUrl: string;
};

export type LibraryCategory = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

export type LibraryBookCopy = {
  id: string;
  copyNumber: number;
  barcode: string;
  status: string;
};

export type LibraryBook = {
  id: string;
  accessionNo: string;
  bookNumber?: string | null;
  isbn?: string | null;
  title: string;
  author?: string | null;
  publisher?: string | null;
  edition?: string | null;
  departmentId?: string | null;
  categoryId?: string | null;
  price?: string | null;
  shelf?: string | null;
  rack?: string | null;
  location?: string | null;
  accessionStatus?: string;
  status: string;
  totalCopies: number;
  category?: LibraryCategory | null;
  copies?: LibraryBookCopy[];
};

export type LibraryBookListResponse = {
  items: LibraryBook[];
  total: number;
  page: number;
  limit: number;
};

export type LibraryVisit = {
  id: string;
  memberType: string;
  studentId?: string | null;
  staffProfileId?: string | null;
  visitorId?: string | null;
  entryAt: string;
  exitAt?: string | null;
  durationMinutes?: number | null;
  memberName?: string;
  department?: string | null;
};

export type LibraryVisitor = {
  id: string;
  passNumber: string;
  fullName: string;
  mobile?: string | null;
  institution?: string | null;
  purpose?: string | null;
};

export type LibraryLoan = {
  id: string;
  memberType: string;
  studentId?: string | null;
  staffProfileId?: string | null;
  issuedAt: string;
  dueAt: string;
  returnedAt?: string | null;
  status: string;
  copy: { barcode: string; book: LibraryBook };
  fines?: LibraryFine[];
  projectedFine?: number;
  daysOverdue?: number;
};

export type LibraryFine = {
  id: string;
  amount: number;
  reason?: string | null;
  paidAt?: string | null;
  waivedAt?: string | null;
  status?: 'UNPAID' | 'PAID' | 'WAIVED';
  loan?: {
    studentId?: string | null;
    copy: { barcode: string; book: { title: string; accessionNo?: string } };
  };
};

export type LibrarySettings = {
  totalSeats: number;
  finePerDay: string;
  graceDays: number;
  maxFine: string;
  defaultLoanDays: number;
  roomId?: string | null;
  qrEntryEnabled?: boolean;
  selfCheckInEnabled?: boolean;
  zonesEnabled?: boolean;
  blockIssueOnUnpaidFines?: boolean;
  overdueNotifyEnabled?: boolean;
  dueTomorrowNotifyEnabled?: boolean;
  assistantEnabled?: boolean;
  rfidEntryEnabled?: boolean;
  maxRenewals?: number;
  allowedMimeTypes?: string[];
  circulationPolicy?: CirculationPolicy;
  finePolicy?: FinePolicy;
  accessionPrefix?: string;
  accessionNextSeq?: number;
};

export type LibraryAssistantResponse = {
  answer: string;
  links: Array<{ label: string; href: string }>;
  results: Array<{
    type: 'BOOK' | 'DIGITAL' | 'RESEARCH';
    title: string;
    meta: string;
    id?: string;
  }>;
  suggestedFollowUps: string[];
  source: string;
};

export type LibraryReadingZone = {
  id: string;
  code: string;
  name: string;
  totalSeats: number;
  sortOrder: number;
  active: boolean;
  occupied?: number;
  available?: number;
  occupancyPercent?: number;
};

export type LibraryQrPass = {
  payload: string;
  enrollmentNumber: string;
  fullName: string;
  qrImageUrl: string;
};

export type LibrarySearchResult = {
  books: { id: string; title: string; author?: string | null; accessionNo: string; type: 'BOOK' }[];
  digital: {
    id: string;
    title: string;
    author?: string | null;
    assetType: string;
    type: 'DIGITAL';
  }[];
  research: { id: string; title: string; itemType: string; type: 'RESEARCH' }[];
  total: number;
};

export type LibraryReservation = {
  id: string;
  bookId: string;
  studentId: string;
  status: string;
  reservedAt: string;
  book?: LibraryBook;
  studentName?: string;
  enrollmentNumber?: string | null;
  department?: string | null;
  queuePosition?: number | null;
};

export type LibraryReservationQueueGroup = {
  bookId: string;
  bookTitle: string;
  accessionNo: string;
  queue: LibraryReservation[];
};

export type LibraryRecommendedBook = {
  bookId: string;
  title: string;
  author: string | null;
  accessionNo: string;
  category: string | null;
  availableCopies: number;
  score: number;
  reasons: string[];
};

export type StudentLibraryDashboard = {
  profile: {
    fullName: string;
    department: string | null;
    programme: string | null;
    semester: number | null;
  };
  readingScore: {
    overall: number;
    visitsPoints: number;
    loansPoints: number;
    onTimePoints: number;
    membershipPoints: number;
    visitCount: number;
    totalLoans: number;
    onTimeReturns: number;
  };
  stats: {
    totalVisits: number;
    totalLoans: number;
    activeLoans: number;
    activeReservations: number;
    outstandingFine: number;
  };
  activeLoans: {
    id: string;
    bookTitle: string;
    dueAt: string;
    isOverdue: boolean;
  }[];
  readingHistory: {
    id: string;
    bookTitle: string;
    author: string | null;
    issuedAt: string;
    returnedAt: string | null;
    wasOverdue: boolean;
  }[];
  recommendations: LibraryRecommendedBook[];
};

export type LibraryNaacReportBundle = {
  generatedAt: string;
  period: { from: string; to: string };
  academicYear?: string;
  summary: {
    totalTitles: number;
    totalCopies: number;
    availableCopies: number;
    digitalAssets: number;
    researchItems: number;
    activeLoans: number;
    overdueLoans: number;
  };
  footfall: {
    totalVisits: number;
    male: number;
    female: number;
    other: number;
    peakHour: number;
    peakCount: number;
  };
  booksAddedYearWise: { year: number; titles: number; copies: number }[];
  departmentUsage: {
    departmentName: string;
    visits: number;
    issues: number;
    uniqueReaders: number;
  }[];
  studentUsage: {
    uniqueStudents: number;
    totalVisits: number;
    totalIssues: number;
  };
  facultyUsage: {
    uniqueFaculty: number;
    totalVisits: number;
    totalIssues: number;
  };
  eResourceUsage: {
    digitalDownloads: number;
    digitalViews: number;
    researchAccess: number;
    topDigital: { title: string; downloads: number }[];
  };
  readingStatistics: {
    topBooks: { title: string; issueCount: number }[];
    topReaders: {
      fullName: string;
      issueCount: number;
      department?: string | null;
    }[];
  };
  expenditure: {
    finesCollected: number;
    finesWaived: number;
    bookValueOnShelf: number;
    note: string;
  };
  journalSubscriptions: {
    printJournalTitles: number;
    digitalJournalAssets: number;
    eJournalDownloads: number;
  };
};

export type LibraryCopyIncident = {
  id: string;
  copyId: string;
  loanId?: string | null;
  incidentType: string;
  status: string;
  notes?: string | null;
  chargeAmount?: number | null;
  replacementCopyId?: string | null;
  reportedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  copy?: {
    barcode: string;
    book?: { title: string; accessionNo: string };
  };
  replacementCopy?: { id: string; barcode: string } | null;
};

export type LibraryDigitalAsset = {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  assetType: string;
  categoryId?: string | null;
  status: string;
  visibility: string;
  sourceType?: string;
  fileName?: string | null;
  mimeType?: string | null;
  downloadCount?: number;
  viewCount?: number;
  publishedAt?: string | null;
  category?: LibraryCategory | null;
};

export type LibraryDigitalAssetListResponse = {
  items: LibraryDigitalAsset[];
  total: number;
  page: number;
  limit: number;
};

export type ResearchRepositoryItem = {
  id: string;
  title: string;
  abstract?: string | null;
  itemType: string;
  departmentId?: string | null;
  publicationYear?: number | null;
  journalName?: string | null;
  doi?: string | null;
  status: string;
  downloadCount?: number;
  viewCount?: number;
  publishedAt?: string | null;
};

export type ResearchItemListResponse = {
  items: ResearchRepositoryItem[];
  total: number;
  page: number;
  limit: number;
};

export type LibraryReadingAnalytics = {
  from: string;
  days: number;
  topBooks: {
    bookId: string;
    title: string;
    author: string | null;
    accessionNo: string;
    issueCount: number;
  }[];
  topReaders: {
    memberType: string;
    memberId: string;
    fullName: string;
    registrationNumber: string | null;
    department: string | null;
    issueCount: number;
  }[];
  departmentUsage: {
    departmentId: string | null;
    departmentName: string;
    issueCount: number;
    uniqueReaders: number;
    intensity: number;
  }[];
};

export type LibraryMemberListItem = {
  memberType: string;
  memberId: string;
  studentId?: string | null;
  staffProfileId?: string | null;
  fullName: string;
  registrationNumber?: string | null;
  department?: string | null;
  programme?: string | null;
  semester?: number | null;
  loanCount: number;
  visitCount: number;
  activeLoans: number;
  outstandingFine: number;
  lastVisitAt: string | null;
  readingScore: number;
};

export type LibraryMemberListResponse = {
  items: LibraryMemberListItem[];
  total: number;
  page: number;
  limit: number;
};

export type LibraryMemberDetail = {
  profile: LibraryMemberListItem | undefined;
  stats: {
    visitCount: number;
    loanCount: number;
    activeLoans: number;
    outstandingFine: number;
    readingScore: number;
  };
  recentLoans: {
    id: string;
    title: string;
    accessionNo: string;
    barcode: string;
    issuedAt: string;
    dueAt: string;
    returnedAt: string | null;
    status: string;
  }[];
  recentVisits: {
    id: string;
    entryAt: string;
    exitAt: string | null;
    durationMinutes?: number | null;
  }[];
};

export type LibraryNextAccession = {
  accessionNo: string;
  prefix: string;
  nextSeq: number;
};
