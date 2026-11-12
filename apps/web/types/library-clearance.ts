export type ClearanceChecklist = {
  booksReturned: 'YES' | 'NO';
  duesStatus: 'CLEARED' | 'PENDING';
  lostDamagedStatus: 'CLEARED' | 'PENDING';
  accountStatus: 'CLEARED' | 'NOT_CLEARED';
};

export type ClearanceRow = {
  kind: 'CARD' | 'NOT_PROCESSED';
  id: string | null;
  studentId: string;
  cardNumber: string | null;
  studentName: string;
  rollNumber: string | null;
  registrationNumber: string | null;
  programme: string | null;
  department: string | null;
  semester: number;
  semesterLabel: string;
  academicYear: string | null;
  examinationName: string | null;
  academicSession: string | null;
  mobileNumber: string | null;
  status: 'CLEARED' | 'PENDING' | 'NOT_PROCESSED' | string;
  booksReturned: 'YES' | 'NO' | null;
  duesStatus: 'CLEARED' | 'PENDING' | null;
  lostDamagedStatus: 'CLEARED' | 'PENDING' | null;
  accountStatus: 'CLEARED' | 'NOT_CLEARED' | null;
  remarks: string | null;
  librarianName: string | null;
  clearedOn: string | null;
  activeLoans: number | null;
  outstandingDues: number | null;
  openIncidents: number | null;
  updatedAt: string | null;
};

export type ClearanceEvent = {
  id: string;
  action: string;
  note: string | null;
  before: unknown;
  after: unknown;
  actorName: string;
  createdAt: string;
};

export type ClearanceDetail = ClearanceRow & {
  membershipBlocked: boolean;
  verifyToken: string;
  events: ClearanceEvent[];
};

export type ClearanceList = {
  summary: {
    totalStudents: number | null;
    cleared: number;
    pending: number;
    notYetProcessed: number | null;
  };
  contextReady: boolean;
  page: number;
  limit: number;
  total: number;
  rows: ClearanceRow[];
};

export type ClearanceOptions = {
  academicYears: { id: string; name: string; status: string; isPrimarySession: boolean }[];
  departments: { id: string; name: string }[];
  programmes: { id: string; name: string; code: string }[];
  examinations: string[];
  semesters: number[];
  collegeName: string;
  librarianName: string;
};

export type ClearanceStudentHit = {
  studentId: string;
  studentName: string;
  rollNumber: string | null;
  registrationNumber: string | null;
  programme: string | null;
  department: string | null;
  currentSemester: number;
  mobileNumber: string;
};

export type ClearancePreview = {
  student: ClearanceStudentHit & {
    studentId: string;
    semester: number;
    semesterLabel: string;
    academicSession: string | null;
  };
  library: ClearanceChecklist & {
    status: 'CLEARED' | 'PENDING';
    suggestedRemarks: string | null;
    activeLoans: number;
    outstandingDues: number;
    openIncidents: number;
    membershipBlocked: boolean;
  };
  existing: ClearanceRow | null;
};

export type ClearanceDecision = ClearanceChecklist & {
  status: 'PENDING' | 'CLEARED';
  remarks?: string;
  librarianName?: string;
  clearedOn?: string;
};

export type ClearanceBulkResult = {
  created: number;
  skipped: number;
  cleared: number;
  pending: number;
  capped: boolean;
};
