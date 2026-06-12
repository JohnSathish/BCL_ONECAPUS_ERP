export type FrontOfficeDashboard = {
  todayEnquiries: number;
  openEnquiries: number;
  openComplaints: number;
  highPriorityComplaints: number;
  activeGatePasses: number;
  visitorsInside: number;
  todayGatePasses: number;
  pendingAdmissions?: number;
  admissionsHref?: string;
  recentEnquiries: FrontOfficeEnquiry[];
  recentComplaints: FrontOfficeComplaint[];
};

export type FrontOfficeEnquiry = {
  id: string;
  enquiryNo: string;
  enquiryType: string;
  fullName: string;
  mobile?: string | null;
  email?: string | null;
  programmeInterest?: string | null;
  source?: string | null;
  notes?: string | null;
  status: string;
  admissionApplicationId?: string | null;
  createdAt: string;
};

export type FrontOfficeGatePass = {
  id: string;
  passNumber: string;
  scanCode?: string;
  scanPayload?: string;
  qrImageUrl?: string;
  visitorName: string;
  mobile?: string | null;
  hostName?: string | null;
  hostDepartment?: string | null;
  purpose?: string | null;
  vehicleNo?: string | null;
  validFrom: string;
  validUntil: string;
  status: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  createdAt: string;
};

export type FrontOfficeComplaint = {
  id: string;
  ticketNo: string;
  category: string;
  priority: string;
  complainantName: string;
  complainantMobile?: string | null;
  subject: string;
  description: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
};

export type FrontOfficeListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type FrontOfficeAdmissionsDeskSummary = {
  pendingReview: number;
  submittedToday: number;
  linkedEnquiries: number;
  admissionsHref: string;
  recentApplications: Array<{
    id: string;
    applicationNumber: string;
    fullName: string;
    phone?: string | null;
    status: string;
    adminHref: string;
  }>;
};

export type FrontOfficeKioskScanResult = {
  pass: FrontOfficeGatePass;
  action: 'CHECK_IN' | 'CHECK_OUT' | 'NONE' | 'CHECKED_IN' | 'CHECKED_OUT';
  message: string;
};
