export type CertificateCategory = {
  id: string;
  code: string;
  name: string;
  group: string;
  description?: string | null;
  isActive: boolean;
};

export type CertificateTemplateVersion = {
  id: string;
  version: number;
  mode: string;
  html: string;
  layout: Record<string, unknown>;
  variables: string[];
  isPublished: boolean;
};

export type CertificateTemplate = {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  description?: string | null;
  language: string;
  orientation: string;
  pageSize: string;
  status: string;
  category?: CertificateCategory;
  versions?: CertificateTemplateVersion[];
};

export type CertificateRequest = {
  id: string;
  categoryId: string;
  templateId?: string | null;
  studentId: string;
  requestNo: string;
  requestType: string;
  status: string;
  priority: string;
  purpose?: string | null;
  submittedAt: string;
  category?: CertificateCategory;
  approvals?: CertificateApproval[];
  issues?: CertificateIssue[];
  variableData?: Record<string, unknown> | null;
};

export type CertificateApproval = {
  id: string;
  requestId: string;
  stepCode: string;
  stepName: string;
  roleSlug?: string | null;
  status: string;
  comments?: string | null;
  sequence: number;
};

export type CertificateIssue = {
  id: string;
  categoryId: string;
  templateId?: string | null;
  requestId?: string | null;
  studentId: string;
  certificateNo: string;
  issueType: string;
  status: string;
  renderedHtml?: string | null;
  qrPayload?: string | null;
  verificationToken: string;
  issuedAt: string;
  category?: CertificateCategory;
};

export type CertificateDashboard = {
  kpis: {
    categories: number;
    templates: number;
    requests: number;
    pendingRequests: number;
    pendingApprovals: number;
    issuedToday: number;
    totalIssued: number;
    verificationRequests: number;
  };
  trends: { month: string; issued: number }[];
  mostRequested: { label: string; value: number }[];
  statusMix: { label: string; value: number }[];
  recentIssues: CertificateIssue[];
};

export type CertificateVerificationResult = {
  valid: boolean;
  status: string;
  certificateNo: string;
  certificateType: string;
  studentName: string;
  programme: string;
  issueDate: string;
  institution: string;
};
