import { api } from '@/services/api';

export type ShiftRow = {
  id: string;
  institutionId: string;
  campusId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  status: string;
  sortOrder: number;
  description?: string | null;
  institution?: { id: string; name: string; code?: string | null };
  campus?: { id: string; name: string; code?: string | null };
};

export type ShiftOperationsSummary = {
  shiftId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  students: number;
  activeSections: number;
  facultyAssignments: number;
  timetableEntries: number;
  pendingApprovals: number;
};

export type ShiftAdminAssignment = {
  id: string;
  userId: string;
  shiftId: string;
  isPrimary: boolean;
  user?: {
    id: string;
    email: string;
    isActive: boolean;
    roles: { role: { slug: string; name: string } }[];
  } | null;
};

export type ShiftSummaryRow = {
  shiftId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  students: number;
  registrations: number;
  sections: number;
};

export async function fetchShifts(params?: {
  campusId?: string;
  institutionId?: string;
  status?: string;
}): Promise<ShiftRow[]> {
  const { data } = await api.get('/v1/shifts', { params });
  return data;
}

export async function createShift(payload: {
  institutionId: string;
  campusId: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  shiftType?: string;
  status?: string;
  sortOrder?: number;
}) {
  const { data } = await api.post('/v1/shifts', payload);
  return data as ShiftRow;
}

export async function updateShift(
  id: string,
  payload: Partial<{
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    shiftType: string;
    status: string;
    sortOrder: number;
  }>,
) {
  const { data } = await api.patch(`/v1/shifts/${id}`, payload);
  return data as ShiftRow;
}

export async function deleteShift(id: string) {
  await api.delete(`/v1/shifts/${id}`);
}

export async function fetchShiftSummary(campusId?: string): Promise<ShiftSummaryRow[]> {
  const { data } = await api.get('/v1/reports/shift-summary', {
    params: campusId ? { campusId } : undefined,
  });
  return data;
}

export async function fetchShiftOperationsSummary(
  campusId?: string,
): Promise<ShiftOperationsSummary[]> {
  const { data } = await api.get('/v1/shifts/operations/summary', {
    params: campusId ? { campusId } : undefined,
  });
  return data;
}

export async function activateShift(id: string) {
  const { data } = await api.post(`/v1/shifts/${id}/activate`);
  return data as ShiftRow;
}

export async function deactivateShift(id: string) {
  const { data } = await api.post(`/v1/shifts/${id}/deactivate`);
  return data as ShiftRow;
}

export async function reorderShifts(shiftIds: string[]) {
  const { data } = await api.post('/v1/shifts/reorder', { shiftIds });
  return data;
}

export async function fetchShiftAdmins(shiftId: string) {
  const { data } = await api.get(`/v1/shifts/${shiftId}/admins`);
  return data as ShiftAdminAssignment[];
}

export async function assignShiftAdmin(
  shiftId: string,
  payload: { userId: string; isPrimary?: boolean },
) {
  const { data } = await api.post(`/v1/shifts/${shiftId}/admins`, payload);
  return data;
}

export async function unassignShiftAdmin(shiftId: string, userId: string) {
  await api.delete(`/v1/shifts/${shiftId}/admins/${userId}`);
}

export async function assignShiftAdminByEmail(
  shiftId: string,
  payload: {
    email: string;
    isPrimary?: boolean;
    createIfMissing?: boolean;
    password?: string;
  },
) {
  const { data } = await api.post(`/v1/shifts/${shiftId}/admins/by-email`, payload);
  return data;
}

export type ShiftAdminCandidate = {
  id: string;
  email: string;
  isActive: boolean;
  shiftAssignments: {
    shiftId: string;
    isPrimary: boolean;
    shift: { id: string; name: string; code: string };
  }[];
  roles: { role: { slug: string; name: string } }[];
};

export async function fetchShiftAdminCandidates(search?: string) {
  const { data } = await api.get('/v1/shifts/admin-users', {
    params: search ? { search } : undefined,
  });
  return data as ShiftAdminCandidate[];
}
