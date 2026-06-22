import { api } from '@/services/api';

export type AppointmentOrderDashboard = {
  issued: number;
  pendingAcceptance: number;
  joined: number;
  notJoined: number;
  probation: number;
  confirmed: number;
  temporary: number;
  contract: number;
  visiting: number;
};

export type AppointmentCandidate = {
  id: string;
  fullName: string;
  fatherName?: string;
  email?: string;
  mobile?: string;
  dateOfBirth?: string;
  qualification?: string;
  photoUrl?: string;
  addressText?: string;
  vacancy?: {
    title: string;
    department?: { id: string; name: string };
    designation?: { id: string; label: string };
  };
};

export type AppointmentOrder = {
  id: string;
  orderNo?: string;
  referenceNo?: string;
  status: string;
  candidateName: string;
  appointmentType: string;
  staffType: string;
  joiningDate?: string;
  basicPay?: number | string;
  grossSalary?: number | string;
  netSalary?: number | string;
  renderedHtml?: string;
  pdfPath?: string;
  verifyCode?: string;
  signedCopyUrl?: string;
  rejectionReason?: string;
  createdAt: string;
  generatedAt?: string;
  sentAt?: string;
  acceptedAt?: string;
  auditLogs?: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorId?: string;
  }>;
};

export type SalaryPreview = {
  lines: Array<{ name: string; amount: number; componentType: string; code?: string }>;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
};

export type JoiningReport = {
  id: string;
  status: string;
  actualJoiningDate: string;
  reportingDate?: string;
  remarks?: string;
  documentUrl?: string;
  appointmentOrder?: {
    id: string;
    orderNo?: string;
    candidateName: string;
    status: string;
  };
  staffProfile?: { id: string; fullName: string; employeeCode: string };
};

export type ProbationStaff = {
  id: string;
  fullName: string;
  employeeCode: string;
  probationEndDate?: string;
  department?: { name: string };
  designation?: { label: string };
};

export async function fetchAppointmentDashboard() {
  const { data } = await api.get<{ data: AppointmentOrderDashboard }>(
    '/v1/hr/appointment-orders/dashboard',
  );
  return data.data ?? data;
}

export async function fetchAppointmentOrders(params?: Record<string, string>) {
  const { data } = await api.get<{ data: AppointmentOrder[] }>('/v1/hr/appointment-orders', {
    params,
  });
  return data.data ?? data;
}

export async function fetchAppointmentOrder(id: string) {
  const { data } = await api.get<{ data: AppointmentOrder }>(`/v1/hr/appointment-orders/${id}`);
  return data.data ?? data;
}

export async function fetchAppointmentCandidates(search?: string) {
  const { data } = await api.get<{ data: AppointmentCandidate[] }>(
    '/v1/hr/appointment-orders/candidates',
    { params: { search } },
  );
  return data.data ?? data;
}

export async function fetchAppointmentCandidate(applicationId: string) {
  const { data } = await api.get<{ data: AppointmentCandidate }>(
    `/v1/hr/appointment-orders/candidates/${applicationId}`,
  );
  return data.data ?? data;
}

export async function fetchAppointmentTemplates() {
  const { data } = await api.get('/v1/hr/appointment-orders/templates');
  return data.data ?? data;
}

export async function seedAppointmentTemplates() {
  const { data } = await api.post('/v1/hr/appointment-orders/templates/seed');
  return data;
}

export async function previewAppointmentSalary(body: {
  payStructureTemplateId: string;
  basicPay: number;
}) {
  const { data } = await api.post<{ data: SalaryPreview }>(
    '/v1/hr/appointment-orders/preview-salary',
    body,
  );
  return data.data ?? data;
}

export async function createAppointmentOrder(body: Record<string, unknown>) {
  const { data } = await api.post('/v1/hr/appointment-orders', body);
  return data.data ?? data;
}

export async function updateAppointmentOrder(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/hr/appointment-orders/${id}`, body);
  return data.data ?? data;
}

export async function generateAppointmentOrder(id: string) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/generate`);
  return data.data ?? data;
}

export async function sendAppointmentOrder(id: string) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/send`);
  return data.data ?? data;
}

export async function acceptAppointmentOrder(id: string, body?: { signedCopyUrl?: string }) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/accept`, body ?? {});
  return data.data ?? data;
}

export async function rejectAppointmentOrder(id: string, reason: string) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/reject`, { reason });
  return data.data ?? data;
}

export async function cancelAppointmentOrder(id: string, reason?: string) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/cancel`, { reason });
  return data.data ?? data;
}

export async function reissueAppointmentOrder(id: string) {
  const { data } = await api.post(`/v1/hr/appointment-orders/${id}/reissue`);
  return data.data ?? data;
}

export function appointmentOrderPdfUrl(id: string) {
  return `/api/v1/hr/appointment-orders/${id}/pdf`;
}

export async function verifyAppointmentOrder(token: string) {
  const { data } = await api.get(`/v1/verify/appointment-order/${token}`);
  return data as {
    valid: boolean;
    orderNo?: string;
    candidateName?: string;
    status?: string;
    verifyCode?: string;
    generatedAt?: string;
  };
}

export async function fetchJoiningReports(status?: string) {
  const { data } = await api.get<{ data: JoiningReport[] }>('/v1/hr/joining-reports', {
    params: { status },
  });
  return data.data ?? data;
}

export async function fetchAcceptedOrdersForJoining() {
  const { data } = await api.get('/v1/hr/joining-reports/accepted-orders');
  return data.data ?? data;
}

export async function createJoiningReport(body: {
  appointmentOrderId: string;
  actualJoiningDate: string;
  reportingDate?: string;
  remarks?: string;
  documentUrl?: string;
}) {
  const { data } = await api.post('/v1/hr/joining-reports', body);
  return data.data ?? data;
}

export async function verifyJoiningReport(id: string) {
  const { data } = await api.post(`/v1/hr/joining-reports/${id}/verify`);
  return data.data ?? data;
}

export async function fetchProbationDashboard() {
  const { data } = await api.get('/v1/hr/probation/dashboard');
  return data.data ?? data;
}

export async function fetchProbationStaff(withinDays = 30) {
  const { data } = await api.get<{ data: ProbationStaff[] }>('/v1/hr/probation', {
    params: { withinDays },
  });
  return data.data ?? data;
}

export async function confirmProbation(staffProfileId: string) {
  const { data } = await api.patch(`/v1/hr/probation/${staffProfileId}/confirm`);
  return data.data ?? data;
}
