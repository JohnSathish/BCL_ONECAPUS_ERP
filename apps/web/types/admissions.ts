export type AdmissionSummary = {
  intakes: number;
  applications: number;
  publishedMeritLists: number;
  activeAllocations: number;
  pendingReview: number;
};

export type AdmissionIntake = {
  id: string;
  name: string;
  code: string;
  totalSeats: number;
  status: string;
  programId: string;
  academicYearId?: string | null;
  program: { id: string; code: string; name: string };
  academicYear?: { id: string; name: string } | null;
  _count: { applications: number; allocations: number };
};

export type AdmissionApplication = {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  category: string;
  academicStreamId?: string | null;
  academicStream?: { id: string; code: string; name: string } | null;
  meritScore: string | number;
  status: string;
  submittedAt?: string | null;
  intake: {
    id: string;
    name: string;
    code: string;
    program: { code: string; name: string };
  };
};

export type MeritList = {
  id: string;
  name: string;
  round: number;
  status: string;
  publishedAt?: string | null;
  intake: { id: string; name: string; program: { code: string } };
  _count: { entries: number };
};

export type MeritListDetail = MeritList & {
  entries: {
    id: string;
    rank: number;
    score: string | number;
    application: AdmissionApplication;
  }[];
};

export type SeatAllocation = {
  id: string;
  round: number;
  status: string;
  allocatedAt: string;
  application: {
    id: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    meritScore: string | number;
  };
  intake: {
    id: string;
    name: string;
    program: { code: string; name: string };
  };
};

export type PaginatedApplications = {
  data: AdmissionApplication[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
