import { api } from '@/services/api';

export type FacultyShiftAssignmentRow = {
  id: string;
  shiftId: string;
  staffProfileId: string;
  isPrimary: boolean;
  active: boolean;
  hoursPerWeek: number | null;
  fullName: string;
  shortCode: string | null;
  employeeCode: string;
  email: string | null;
  staffType: string;
  status: string;
  portalActive: boolean;
  shift: { id: string; code: string; name: string };
  department: { id: string; code: string; name: string } | null;
  designation: { id: string; label: string } | null;
};

export type FacultyShiftCandidate = {
  id: string;
  fullName: string;
  shortCode: string | null;
  employeeCode: string;
  staffType: string;
  department: { id: string; name: string } | null;
  designation: { id: string; label: string } | null;
};

export async function fetchFacultyShiftAssignments(shiftId: string) {
  const { data } = await api.get<FacultyShiftAssignmentRow[]>('/v1/faculty-shifts', {
    params: { shiftId },
  });
  return data;
}

export async function searchFacultyShiftCandidates(shiftId: string, search?: string, limit = 15) {
  const { data } = await api.get<FacultyShiftCandidate[]>('/v1/faculty-shifts/candidates', {
    params: { shiftId, search: search?.trim() || undefined, limit },
  });
  return data;
}

export async function assignFacultyToShift(payload: {
  facultyId: string;
  shiftId: string;
  hoursPerWeek?: number;
}) {
  const { data } = await api.post('/v1/faculty-shifts', payload);
  return data;
}

export async function unassignFacultyFromShift(facultyId: string, shiftId: string) {
  const { data } = await api.delete(`/v1/faculty-shifts/${facultyId}/${shiftId}`);
  return data;
}
