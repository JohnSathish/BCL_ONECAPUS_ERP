export type LibraryMemberType = 'STUDENT' | 'STAFF' | 'FACULTY' | 'VISITOR' | 'RESEARCH_SCHOLAR';

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
  issuedChange?: number | null;
  returnedChange?: number | null;
  titlesGrowth?: number | null;
  copiesGrowth?: number | null;
  digitalViewsToday?: number;
  digitalDownloadsToday?: number;
  activityCounts?: {
    issued: number;
    returned: number;
    renewed: number;
    reserved: number;
  };
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
    days?: number[];
    grid?: { departmentName: string; counts: number[] }[];
  };
  genderTrends?: {
    from: string;
    weekly: { week: number; male: number; female: number; total: number }[];
  };
  healthScore?: LibraryHealthScore;
  activity?: LibraryActivityItem[];
  recentActivity?: LibraryActivityItem[];
  attention?: LibraryAttention;
  departments?: LibraryDepartmentCollection;
  period?: 'today' | 'week' | 'month';
  entryAnalytics?: LibraryEntryAnalytics;
};

export type LibraryHealthComponent = {
  key: string;
  label: string;
  score: number | null;
  detail: string;
  formula: string;
  weight: number;
};

export type LibraryHealthScore = {
  overall: number | null;
  components: LibraryHealthComponent[];
  periodLabel: string;
};

export type LibraryActivityItem = {
  at: string;
  action: 'ISSUE' | 'RETURN' | 'RENEW' | string;
  memberName: string;
  memberCode?: string | null;
  bookTitle: string;
  programme?: string | null;
  accessionNumber?: string | null;
  staffName?: string | null;
  status?: string;
};

export type LibraryAttention = {
  missingAccession: number;
  duplicateGroups: number;
  unprintedLocal: number;
  printHistoryUnknown: number;
};

export type LibraryDepartmentCollection = {
  totalCopies: number;
  rows: Array<{
    departmentId: string | null;
    department: string;
    copies: number;
    percent: number;
  }>;
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
  copyIssue?: Record<string, boolean>;
};

export type FinePolicy = {
  lostBookPenaltyMultiplier: number;
  damageChargeDefault: number;
};

export type LibraryMemberSummary = {
  profile: LibraryMemberProfile;
  activeLoans: LibraryLoan[];
  returnedLoans?: LibraryLoan[];
  borrowedCount: number;
  maxBooks: number;
  outstandingFine: number;
  lastVisitAt: string | null;
  visitCount: number;
  readingScore: number;
  membershipStatus: string;
  blockReason?: string | null;
  fineExempt?: boolean;
};

export type LibraryBookPreview = {
  issueAllowed?: boolean;
  issueMessage?: string | null;
  copy: {
    id: string;
    barcode: string;
    accessionNumber?: string | null;
    status: string;
    copyNumber: number;
    copyType?: string | null;
    issueAllowed?: boolean | null;
  };
  book: {
    id: string;
    title: string;
    author?: string | null;
    publisher?: string | null;
    edition?: string | null;
    isbn?: string | null;
    publicationYear?: string | null;
    coverImageUrl?: string | null;
    accessionNo: string;
    callNumber?: string | null;
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
    issuedYesterday?: number;
    returnedYesterday?: number;
    renewalsToday: number;
    overdueLoans: number;
    issuedNow?: number;
    dueThisWeek?: number;
    totalCopies?: number;
    totalMembers?: number;
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
  accessionNumber?: string | null;
  status: string;
  copyType?: string | null;
  issueAllowed?: boolean | null;
  shelvingLocation?: string | null;
  copyCondition?: string | null;
  copyRemarks?: string | null;
};

export type LibraryBook = {
  id: string;
  accessionNo: string;
  bookNumber?: string | null;
  isbn?: string | null;
  title: string;
  author?: string | null;
  additionalAuthors?: string | null;
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
  publicationYear?: string | null;
  language?: string | null;
  subject?: string | null;
  coverImageUrl?: string | null;
  classificationNumber?: string | null;
  departmentName?: string | null;
  copyCount?: number;
  availableCopies?: number;
  issuedCopies?: number;
  category?: LibraryCategory | null;
  copies?: LibraryBookCopy[];
};

export type LibraryBookListResponse = {
  items: LibraryBook[];
  total: number;
  page: number;
  limit: number;
  from?: number;
  to?: number;
  facets?: {
    all: number;
    available: number;
    borrowed: number;
    reserved: number;
  } | null;
};

export type LibraryCatalogueSummary = {
  copies: number;
  titles: number;
  authors: number;
  categories: number;
  departments: number;
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
  programme?: string | null;
  registrationNumber?: string | null;
  photoUrl?: string | null;
  status?: 'INSIDE' | 'COMPLETED' | 'REVIEW';
  ongoing?: boolean;
  purpose?: string | null;
  institution?: string | null;
  entryMethod?: string | null;
  zoneName?: string | null;
};

export type LibraryVisitStats = {
  totalToday: number;
  yesterdayTotal: number;
  totalDeltaPct: number | null;
  students: number;
  studentSharePct: number | null;
  staff: number;
  staffSharePct: number | null;
  visitors: number;
  visitorSharePct: number | null;
  averageDurationMinutes: number | null;
  completedVisits: number;
  previousAverageDurationMinutes: number | null;
  averageDeltaPct: number | null;
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
  receiptNo?: string | null;
  issuedByName?: string | null;
  copy: { barcode: string; book: LibraryBook; accessionNumber?: string | null };
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
  maxUploadMb?: number;
  studentDigitalAccessEnabled?: boolean;
  updatedAt?: string;
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
  memberType?: string;
  author?: string | null;
  accessionNo?: string | null;
  expiresOn?: string | null;
  queuePosition?: number | null;
};

export type LibraryReservationListResponse = {
  items: LibraryReservation[];
  total: number;
  page: number;
  limit: number;
  from: number;
  to: number;
};

export type LibraryReservationSummary = {
  active: number;
  titles: number;
  longestDays: number;
  fulfilledToday: number;
  fulfilled: number;
  cancelled: number;
  expired: number;
  expiryTracked: boolean;
  departments: { id: string; name: string }[];
};

export type LibraryReservationStudent = {
  id: string;
  fullName: string;
  enrollmentNumber: string;
  department: string | null;
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
  overview: {
    titles: number;
    copies: number;
    digital: number;
    members: number;
    students: number;
    staff: number;
    visits: number;
    activeLoans: number;
    issues: number;
    activeMembers: number;
    averageLoanDays: number | null;
    seats: number | null;
    automation: string[];
    growth: {
      titles: number | null;
      copies: number | null;
      digital: number | null;
      members: number | null;
      visits: number | null;
    };
    departments: {
      department: string;
      titles: number;
      copies: number;
      available: number;
      issued: number;
      overdue: number;
      lostDamaged: number;
      eResources: number;
    }[];
    resourceTypes: { name: string; count: number }[];
    years: { year: number; titles: number; copies: number; eResources: number }[];
    status: {
      available: number;
      issued: number;
      overdue: number;
      lostDamaged: number;
      other: number;
    };
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
  reportedByName?: string | null;
  memberName?: string | null;
  memberType?: string | null;
  title?: string | null;
  author?: string | null;
  accessionNo?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  copy?: {
    barcode: string;
    accessionNumber?: string | null;
    book?: { title: string; author?: string | null; accessionNo: string };
  };
  replacementCopy?: { id: string; barcode: string; accessionNumber?: string | null } | null;
};

export type LibraryIncidentListResponse = {
  items: LibraryCopyIncident[];
  total: number;
  page: number;
  limit: number;
  from: number;
  to: number;
};

export type LibraryIncidentSummary = {
  total: number;
  lost: number;
  damaged: number;
  replaced: number;
  resolved: number;
  closed: number;
  reporters: { id: string; name: string }[];
};

export type LibraryIncidentCopyPreview = {
  copyId: string;
  title: string;
  author: string | null;
  accessionNo: string;
  barcode: string;
  status: string;
  openIncidentId: string | null;
  openIncidentType: string | null;
  chargeAmount: number | null;
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
  departmentId?: string | null;
  departmentName?: string | null;
  addedYear?: number;
  category?: LibraryCategory | null;
};

export type LibraryDigitalAssetListResponse = {
  items: LibraryDigitalAsset[];
  total: number;
  page: number;
  limit: number;
  from?: number;
  to?: number;
};

export type LibraryDigitalSummary = {
  total: number;
  ebooks: number;
  papers: number;
  research: number;
  other: number;
  shares: { ebooks: number; papers: number; research: number; other: number };
  departments: { id: string; name: string }[];
  years: number[];
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

export type LibraryReportsDesk = {
  from: string;
  to: string;
  days: number;
  year: number;
  years: number[];
  summary: {
    totalIssues: number;
    activeMembers: number;
    newReaders: number;
    averageLoanDays: number | null;
    overdue: number;
    deltas: {
      totalIssues: number | null;
      activeMembers: number | null;
      newReaders: number | null;
      averageLoanDays: number | null;
      overdue: number | null;
    };
  };
  months: { month: number; label: string; issued: number; returned: number }[];
  categories: {
    name: string;
    issues: number;
    titles: number;
    issueShare: number;
    titleShare: number;
  }[];
  topBooks: {
    bookId: string;
    title: string;
    author: string | null;
    accessionNo: string;
    issues: number;
  }[];
  topReaders: {
    memberType: string;
    memberId: string;
    fullName: string;
    department: string | null;
    programme: string | null;
    issues: number;
  }[];
  departments: { name: string; issues: number }[];
};

export type LibraryReadingAnalytics = {
  from: string;
  to?: string;
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
    programme?: string | null;
    issueCount: number;
  }[];
  departmentUsage: {
    departmentId: string | null;
    departmentName: string;
    issueCount: number;
    uniqueReaders: number;
    intensity: number;
  }[];
  summary?: {
    from: string;
    to: string;
    totalIssues: number;
    activeReaders: number;
    uniqueTitles: number;
    departmentsActive: number;
    departmentsTotal: number;
    averageLoanDays: number | null;
    mostActiveDay: string | null;
    mostPopularCategory: string | null;
    deltas: {
      totalIssues: number | null;
      activeReaders: number | null;
      uniqueTitles: number | null;
      averageLoanDays: number | null;
    };
  };
  weeklyIssues?: { date: string; label: string; count: number }[];
};

export type LibraryMemberListItem = {
  memberType: string;
  memberId: string;
  studentId?: string | null;
  staffProfileId?: string | null;
  fullName: string;
  registrationNumber?: string | null;
  rollNumber?: string | null;
  libraryCardNumber?: string | null;
  department?: string | null;
  departmentId?: string | null;
  programme?: string | null;
  designation?: string | null;
  semester?: number | null;
  academicYear?: string | null;
  email?: string | null;
  phone?: string | null;
  photoPath?: string | null;
  loanCount: number;
  visitCount: number;
  activeLoans: number;
  overdueLoans?: number;
  outstandingFine: number;
  paidFine?: number;
  waivedFine?: number;
  lastVisitAt: string | null;
  readingScore: number;
  status?: string;
  derivedStatus?: string;
  blockReason?: string | null;
  blockNote?: string | null;
  blockedAt?: string | null;
  fineExempt?: boolean;
  loanLimit?: number | null;
  loanDays?: number | null;
  maxRenewals?: number | null;
  expiresAt?: string | null;
  recordCreatedAt?: string | null;
  membershipSince?: string | null;
  syncedAt?: string | null;
  membershipId?: string | null;
};

export type LibraryMemberSummaryCards = {
  total: number;
  activeStudents: number;
  activeFaculty: number;
  activeStaff: number;
  researchScholars: number;
  inactive: number;
  blocked: number;
  overdueMembers: number;
  fineMembers: number;
  readers: number;
  tabs: {
    all: number;
    students: number;
    faculty: number;
    staff: number;
    researchScholars: number;
    inactive: number;
    blocked: number;
  };
  departments: { id: string; name: string }[];
  academicYears: string[];
  semesters: number[];
  roleDefaults: {
    student: { loanDays: number; maxBooks: number; maxRenewals: number };
    faculty: { loanDays: number; maxBooks: number; maxRenewals: number };
    staff: { loanDays: number; maxBooks: number; maxRenewals: number };
    researchScholar: { loanDays: number; maxBooks: number; maxRenewals: number };
  };
  lastSync: {
    id: string;
    scope: string;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: unknown;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

export type LibraryMemberSyncResult = NonNullable<LibraryMemberSummaryCards['lastSync']>;

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
    overdueLoans: number;
    outstandingFine: number;
    paidFine: number;
    waivedFine: number;
    readingScore: number;
  };
  roleDefaults: { loanDays: number; maxBooks: number; maxRenewals: number } | null;
  recentLoans: {
    id: string;
    title: string;
    accessionNo: string;
    barcode: string;
    subject: string | null;
    issuedAt: string;
    dueAt: string;
    returnedAt: string | null;
    renewalCount: number;
    status: string;
    overdue: boolean;
  }[];
  loansTruncated: boolean;
  fines: {
    id: string;
    title: string;
    amount: number;
    reason: string | null;
    status: string;
    createdAt: string;
    paidAt: string | null;
    waivedAt: string | null;
    waiveReason: string | null;
  }[];
  recentVisits: {
    id: string;
    entryAt: string;
    exitAt: string | null;
    durationMinutes?: number | null;
  }[];
  subjects: { subject: string; count: number }[];
  monthlyLoans: { month: string; count: number }[];
  events: {
    id: string;
    action: string;
    reason: string | null;
    note: string | null;
    actor: string | null;
    createdAt: string;
  }[];
  blockedBy: string | null;
};

export type LibraryNextAccession = {
  accessionNo: string;
  prefix: string;
  nextSeq: number;
};

export type EntryExitPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

export type EntryExitReportParams = {
  from?: string;
  to?: string;
  period?: EntryExitPeriod;
  departmentId?: string;
  programId?: string;
  semester?: number | string;
  gender?: string;
  memberType?: string;
  visitStatus?: string;
  timeRange?: string;
  search?: string;
  studentId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
  longStayMinutes?: number;
};

export type EntryExitVisitRow = {
  id: string;
  slNo?: number;
  memberType: string;
  studentId?: string | null;
  memberCode: string | null;
  memberName: string;
  departmentId: string | null;
  department: string | null;
  programme: string | null;
  semester: number | null;
  gender: string | null;
  date: string;
  entryAt: string;
  exitAt: string | null;
  inTime: string;
  outTime: string;
  durationMinutes: number;
  stayLabel: string;
  status: 'INSIDE' | 'EXITED' | 'INCOMPLETE';
  statusLabel: string;
  zoneName: string | null;
  seatLabel: string | null;
};

export type EntryExitKpi = { value: number; deltaPct: number | null };

export type EntryExitSummary = {
  header: { collegeName: string; libraryName: string };
  range: { from: string; to: string };
  kpis: {
    totalVisits: EntryExitKpi;
    totalEntries: EntryExitKpi;
    totalExits: EntryExitKpi;
    currentlyInside: EntryExitKpi;
    averageStayMinutes: EntryExitKpi;
    longestStayMinutes: EntryExitKpi;
    maleVisitors: EntryExitKpi;
    femaleVisitors: EntryExitKpi;
  };
  peakHour: { label: string; entries: number };
  mostVisitedDepartment: { name: string; visits: number } | null;
  mostFrequentStudent: { code: string; name: string; visits: number } | null;
};
