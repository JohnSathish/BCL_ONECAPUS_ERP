import { api } from '@/services/api';
import type { LibraryQrPass } from '@/types/library';
import type { StudentDashboardView } from '@/types/student-portal';

export type StudentDashboardResponse = StudentDashboardView & {
  qrPass?: LibraryQrPass | null;
};

export async function fetchStudentDashboard(): Promise<StudentDashboardResponse> {
  const { data } = await api.get('/v1/students/me/dashboard');
  return data;
}

export async function fetchStudentPortalMe() {
  const { data } = await api.get('/v1/students/me');
  return data as {
    id: string;
    fullName: string;
    displayFullName: string;
    enrollmentNumber: string;
    photoUrl: string | null;
    rfidNumber: string | null;
    department: string | null;
    programName: string | null;
  };
}

export async function fetchStudentPortalHealth() {
  const { data } = await api.get('/v1/students/me/health');
  return data;
}

export async function fetchStudentPortalProfile(): Promise<
  import('@/types/student-portal-profile').StudentPortalProfile360
> {
  const { data } = await api.get('/v1/students/me/profile');
  return data;
}

export async function submitStudentProfileChangeRequest(payload: {
  section: 'contact' | 'parent';
  changes: Record<string, string | null>;
}) {
  const { data } = await api.post('/v1/students/me/profile/change-requests', payload);
  return data as { id: string; status: string; message: string };
}

export async function submitStudentIdCardPrintRequest(payload: {
  requestType: 'NEW' | 'REPRINT';
  note?: string;
}) {
  const { data } = await api.post('/v1/students/me/id-card/print-requests', payload);
  return data as { id: string; requestType: string; status: string; message: string };
}

export async function uploadStudentPortalDocument(documentType: string, file: File) {
  const form = new FormData();
  form.append('documentType', documentType);
  form.append('file', file);
  const { data } = await api.post('/v1/students/me/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchStudentDeviceSessions() {
  const { data } = await api.get('/v1/students/me/sessions');
  return data;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const { data } = await api.post('/v1/auth/change-password', payload);
  return data as { success: boolean };
}

export async function revokeAllSessions() {
  const { data } = await api.post('/v1/auth/sessions/revoke-all');
  return data as { success: boolean };
}
