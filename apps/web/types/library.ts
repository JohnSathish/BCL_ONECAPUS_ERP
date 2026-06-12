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
};

export type LibraryDashboard = {
  occupancy: OccupancySnapshot;
  todayVisitors: number;
  weekVisitors: number;
  activeLoans: number;
  overdueLoans: number;
  totalBooks: number;
  availableCopies: number;
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
  maxRenewals?: number;
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
