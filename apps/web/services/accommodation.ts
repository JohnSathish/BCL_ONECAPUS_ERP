import { api } from '@/services/api';

export type QuarterStatus = 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export type StaffQuarter = {
  id: string;
  code: string;
  quarterNumber: string;
  quarterType: string;
  block: string | null;
  floor: string | null;
  numberOfRooms: number | null;
  status: QuarterStatus;
  monthlyRent: number;
  waterCharge: number;
  electricityCharge: number;
  maintenanceCharge: number;
  internetCharge: number;
  remarks: string | null;
  activeOccupant?: {
    staffProfileId: string;
    fullName: string;
    employeeCode: string;
    department: string | null;
    allottedAt: string;
  } | null;
};

export type QuarterOccupancy = {
  id: string;
  status: string;
  quarter: {
    id: string;
    code: string;
    quarterNumber: string;
    quarterType: string;
    block: string | null;
  };
  staffProfile: {
    id: string;
    fullName: string;
    employeeCode: string;
    department: { id: string; name: string } | null;
  };
  allottedAt: string;
  vacatedAt: string | null;
  monthlyRent: number;
  waterCharge: number;
  electricityCharge: number;
  maintenanceCharge: number;
  internetCharge: number;
  payrollDeductionEnabled: boolean;
  notes: string | null;
  vacateNotes: string | null;
};

export type AccommodationDashboard = {
  cards: {
    totalQuarters: number;
    occupiedQuarters: number;
    vacantQuarters: number;
    maintenanceQuarters: number;
    reservedQuarters: number;
    activeOccupancies: number;
  };
  revenue: {
    monthlyRentCollection: number;
    pendingCharges: number;
    pendingChargeCount: number;
    outstandingDues: number;
    annualRevenue: number;
  };
  charts: {
    occupancyByBlock: { block: string; total: number; occupied: number; vacant: number }[];
    occupancyByType: { quarterType: string; total: number; occupied: number }[];
  };
};

export async function fetchAccommodationDashboard(): Promise<AccommodationDashboard> {
  const { data } = await api.get<AccommodationDashboard>('/v1/accommodation/dashboard');
  return data;
}

export async function fetchQuarterTypes() {
  const { data } = await api.get<{ id: string; slug: string; name: string }[]>(
    '/v1/accommodation/quarter-types',
  );
  return data;
}

export async function fetchQuarters(params?: {
  search?: string;
  status?: string;
  quarterType?: string;
  block?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get<{
    data: StaffQuarter[];
    meta: { total: number; page: number; totalPages: number };
  }>('/v1/accommodation/quarters', { params });
  return data;
}

export async function fetchQuarter(id: string) {
  const { data } = await api.get(`/v1/accommodation/quarters/${id}`);
  return data;
}

export async function createQuarter(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/accommodation/quarters', payload);
  return data;
}

export async function updateQuarter(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/accommodation/quarters/${id}`, payload);
  return data;
}

export async function archiveQuarter(id: string) {
  const { data } = await api.post(`/v1/accommodation/quarters/${id}/archive`);
  return data;
}

export async function markQuarterMaintenance(id: string) {
  const { data } = await api.post(`/v1/accommodation/quarters/${id}/maintenance`);
  return data;
}

export async function markQuarterVacant(id: string) {
  const { data } = await api.post(`/v1/accommodation/quarters/${id}/vacant`);
  return data;
}

export async function searchStaffForAllotment(q: string) {
  const { data } = await api.get('/v1/accommodation/staff/search', { params: { q } });
  return data;
}

export async function fetchAvailableQuarters() {
  const { data } = await api.get('/v1/accommodation/quarters/available/list');
  return data;
}

export async function allotQuarter(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/accommodation/allotments', payload);
  return data;
}

export async function vacateQuarter(occupancyId: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`/v1/accommodation/allotments/${occupancyId}/vacate`, payload);
  return data;
}

export async function fetchOccupancies(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get<{ data: QuarterOccupancy[]; meta: { total: number } }>(
    '/v1/accommodation/occupancies',
    { params },
  );
  return data;
}

export async function fetchMonthlyCharges(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/accommodation/charges', { params });
  return data;
}

export async function createMonthlyCharge(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/accommodation/charges', payload);
  return data;
}

export async function deleteMonthlyCharge(id: string) {
  const { data } = await api.delete(`/v1/accommodation/charges/${id}`);
  return data;
}

export async function fetchStaffAccommodation(staffProfileId: string) {
  const { data } = await api.get(`/v1/accommodation/staff/${staffProfileId}`);
  return data;
}

export async function fetchOccupancyReport(status?: string) {
  const { data } = await api.get('/v1/accommodation/reports/occupancy', { params: { status } });
  return data;
}

export async function fetchStaffAccommodationRegister() {
  const { data } = await api.get('/v1/accommodation/reports/staff-register');
  return data;
}

export async function fetchAccommodationHistoryReport(quarterId?: string) {
  const { data } = await api.get('/v1/accommodation/reports/history', { params: { quarterId } });
  return data;
}

export async function fetchDepartmentWiseReport() {
  const { data } = await api.get('/v1/accommodation/reports/department-wise');
  return data;
}

export async function fetchPayrollRecoveryReport(
  month: number,
  year: number,
  componentCode?: string,
) {
  const { data } = await api.get('/v1/accommodation/reports/payroll-recovery', {
    params: { month, year, componentCode },
  });
  return data;
}

export async function fetchAuditLogs(params?: { entityType?: string; entityId?: string }) {
  const { data } = await api.get('/v1/accommodation/audit-logs', { params });
  return data;
}

export async function exportOccupancyReportExcel(status?: string) {
  const { downloadBlob } = await import('@/utils/download-blob');
  const res = await api.get('/v1/accommodation/reports/occupancy/export.xlsx', {
    params: { status },
    responseType: 'blob',
  });
  downloadBlob(res.data as Blob, 'quarter-occupancy.xlsx');
}

export async function exportStaffRegisterExcel() {
  const { downloadBlob } = await import('@/utils/download-blob');
  const res = await api.get('/v1/accommodation/reports/staff-register/export.xlsx', {
    responseType: 'blob',
  });
  downloadBlob(res.data as Blob, 'staff-accommodation-register.xlsx');
}

export async function exportPayrollRecoveryExcel(month: number, year: number) {
  const { downloadBlob } = await import('@/utils/download-blob');
  const res = await api.get('/v1/accommodation/reports/payroll-recovery/export.xlsx', {
    params: { month, year },
    responseType: 'blob',
  });
  downloadBlob(res.data as Blob, `accommodation-recovery-${month}-${year}.xlsx`);
}
