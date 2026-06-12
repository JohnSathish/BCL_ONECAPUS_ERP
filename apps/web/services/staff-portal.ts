import { api } from '@/services/api';
import type {
  StaffDashboardData,
  StaffMeProfile,
  StaffPortalDocument,
  StaffSubjectCard,
  StaffTimetableSlot,
} from '@/types/staff-portal';
import type { StaffSubjectAssignment } from '@/types/staff';

export async function fetchStaffMe(): Promise<StaffMeProfile> {
  const { data } = await api.get('/v1/staff/me');
  return data;
}

export async function fetchStaffDashboard(): Promise<StaffDashboardData> {
  const { data } = await api.get('/v1/staff/me/dashboard');
  return data;
}

export async function fetchMySubjectAssignments(): Promise<
  (StaffSubjectAssignment & { studentCount: number })[]
> {
  const { data } = await api.get('/v1/staff/me/subject-assignments');
  return data;
}

export async function fetchMyDocuments(): Promise<StaffPortalDocument[]> {
  const { data } = await api.get('/v1/staff/me/documents');
  return data;
}

export async function fetchMyDocumentCompliance() {
  const { data } = await api.get('/v1/staff/me/documents/compliance');
  return data;
}

export async function uploadMyDocument(documentType: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const { data } = await api.post('/v1/staff/me/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchMyTodaySchedule(): Promise<StaffTimetableSlot[]> {
  const { data } = await api.get('/v1/staff/me/timetable/today');
  return data;
}

export type { StaffDashboardData, StaffMeProfile, StaffSubjectCard };
