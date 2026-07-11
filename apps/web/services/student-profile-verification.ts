import { api } from '@/services/api';

export type ProfileSoftGate = {
  enabled: boolean;
  minCompletionPercent: number;
  remindOnLogin: boolean;
  softBlockRegistration: boolean;
  softBlockCertificates: boolean;
  completionPercent?: number;
  missing?: Array<{ key: string; label: string }>;
  incomplete?: boolean;
  active?: boolean;
  blockRegistration?: boolean;
  blockCertificates?: boolean;
  message?: string | null;
};

export type ProfileCompletion = {
  percent: number;
  filledCount: number;
  totalCount: number;
  missing: Array<{ key: string; label: string }>;
  checks: Array<{ key: string; label: string; filled: boolean }>;
  canSubmit?: boolean;
  softGate?: ProfileSoftGate;
};

export type ProfileChangeRequest = {
  id: string;
  status: string;
  submittedAt?: string;
  remarks?: string | null;
  student?: {
    id: string;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
    masterProfile?: { fullName?: string | null; mobileNumber?: string | null } | null;
    department?: { name?: string | null } | null;
  };
  items?: Array<{
    id: string;
    sectionKey: string;
    fieldKey: string;
    oldValue?: string | null;
    newValue?: string | null;
    approvalStatus: string;
    autoApproved?: boolean;
  }>;
};

export type ProfileUpdatePolicy = {
  id: string;
  sectionKey: string;
  fieldKey: string;
  approvalMode: string;
  mandatory: boolean;
  enabled: boolean;
  sortOrder: number;
};

export async function fetchMyProfileCompletion() {
  const { data } = await api.get<ProfileCompletion>('/v1/students/me/profile/completion');
  return data;
}

export type ProfileLookupOption = { id: string; label: string; code?: string | null };

export type ProfileBootstrap = {
  student: {
    id: string;
    fullName?: string | null;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
    admissionNumber?: string | null;
    photoPath?: string | null;
    department?: string | null;
    programme?: string | null;
    semester?: number | null;
  };
  sections: Record<string, any>;
  completion: ProfileCompletion;
  profileUpdate?: ProfileUpdateWindowAccess;
  visibleSections?: { bank?: boolean };
  verificationStatus: string;
  changeRequests: ProfileChangeRequest[];
  lookups: {
    bloodGroup: ProfileLookupOption[];
    religion: ProfileLookupOption[];
    category: ProfileLookupOption[];
    nationality: ProfileLookupOption[];
    gender: ProfileLookupOption[];
  };
  staticOptions: {
    genderFallback: Array<{ value: string; label: string }>;
    maritalStatus: Array<{ value: string; label: string }>;
    stream: Array<{ value: string; label: string }>;
    board: string[];
    yearOfPassing: number[];
  };
  readOnly: Record<string, string | number | null | undefined>;
};

export async function fetchMyProfileBootstrap() {
  const { data } = await api.get<ProfileBootstrap>('/v1/students/me/profile/bootstrap');
  return data;
}

export async function fetchMyProfileSection(section: string) {
  const { data } = await api.get(`/v1/students/me/profile/sections/${section}`);
  return data;
}

export async function submitMyProfileChanges(
  changes: Array<{ sectionKey: string; fieldKey: string; newValue: unknown }>,
) {
  const { data } = await api.post('/v1/students/me/profile/submissions', { changes });
  return data;
}

export async function fetchMyClassXii() {
  const { data } = await api.get('/v1/students/me/profile/class-xii');
  return data;
}

export async function upsertMyClassXii(payload: Record<string, unknown>) {
  const { data } = await api.put('/v1/students/me/profile/class-xii', payload);
  return data;
}

export async function fetchMyProfileChangeRequests() {
  const { data } = await api.get('/v1/students/me/profile/change-requests');
  return data;
}

export async function fetchProfileVerificationPending(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get<ProfileChangeRequest[]>(
    '/v1/students/profile-verification/pending',
    { params },
  );
  return data;
}

export async function fetchProfileVerificationHistory(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get<ProfileChangeRequest[]>(
    '/v1/students/profile-verification/history',
    { params },
  );
  return data;
}

export async function fetchClassXiiVerificationQueue() {
  const { data } = await api.get<ProfileChangeRequest[]>(
    '/v1/students/profile-verification/class-xii',
  );
  return data;
}

export async function fetchPendingStudentDocuments() {
  const { data } = await api.get('/v1/students/profile-verification/documents');
  return data;
}

export async function fetchProfileCompletionDashboard() {
  const { data } = await api.get('/v1/students/profile-verification/completion-dashboard');
  return data;
}

export async function fetchProfileUpdatePolicy() {
  const { data } = await api.get<ProfileUpdatePolicy[]>('/v1/students/profile-verification/policy');
  return data;
}

export async function updateProfileUpdatePolicy(
  rows: Array<{
    sectionKey: string;
    fieldKey: string;
    approvalMode?: string;
    mandatory?: boolean;
    enabled?: boolean;
  }>,
) {
  const { data } = await api.put('/v1/students/profile-verification/policy', { rows });
  return data;
}

export async function reviewProfileRequest(
  id: string,
  action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
  remarks?: string,
) {
  const { data } = await api.post(`/v1/students/profile-verification/requests/${id}/review`, {
    action,
    remarks,
  });
  return data;
}

export async function bulkReviewProfileRequests(
  requestIds: string[],
  action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
  remarks?: string,
) {
  const { data } = await api.post('/v1/students/profile-verification/requests/bulk-review', {
    requestIds,
    action,
    remarks,
  });
  return data as {
    action: string;
    processed: number;
    succeeded: number;
    failed: number;
  };
}

export async function reviewProfileItem(
  id: string,
  action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO',
  remarks?: string,
) {
  const { data } = await api.post(`/v1/students/profile-verification/items/${id}/review`, {
    action,
    remarks,
  });
  return data;
}

export type ProfileUpdateWindowAccess = {
  enabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  closedMessage: string;
  bankSectionVisible?: boolean;
  windowOpen?: boolean;
  canEdit: boolean;
  reopenUntil?: string | null;
  message?: string | null;
};

export type ProfileUpdateWindowSettings = {
  enabled: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  closedMessage: string;
  bankSectionVisible?: boolean;
};

export async function fetchProfileSoftGates() {
  const { data } = await api.get<ProfileSoftGate>('/v1/students/profile-verification/soft-gates');
  return data;
}

export async function updateProfileSoftGates(payload: Partial<ProfileSoftGate>) {
  const { data } = await api.put<ProfileSoftGate>(
    '/v1/students/profile-verification/soft-gates',
    payload,
  );
  return data;
}

export async function fetchProfileUpdateWindow() {
  const { data } = await api.get<ProfileUpdateWindowSettings>(
    '/v1/students/profile-verification/update-window',
  );
  return data;
}

export async function updateProfileUpdateWindow(payload: Partial<ProfileUpdateWindowSettings>) {
  const { data } = await api.put<ProfileUpdateWindowSettings>(
    '/v1/students/profile-verification/update-window',
    payload,
  );
  return data;
}

export async function reopenAllProfileUpdate(payload: {
  startsAt?: string | null;
  endsAt: string;
}) {
  const { data } = await api.post('/v1/students/profile-verification/reopen-all', payload);
  return data as ProfileUpdateWindowSettings;
}

export async function reopenStudentProfileUpdate(
  rollNumber: string,
  payload: { reopenUntil: string; reason?: string },
) {
  const { data } = await api.post('/v1/students/profile-verification/reopen-student', {
    rollNumber,
    ...payload,
  });
  return data;
}

export async function revokeStudentProfileUpdate(rollNumber: string) {
  const { data } = await api.post('/v1/students/profile-verification/revoke-student-reopen', {
    rollNumber,
  });
  return data;
}

export async function exportProfileVerificationReport(
  type: string,
  format: 'xlsx' | 'csv' | 'pdf' = 'xlsx',
) {
  const { data } = await api.get(`/v1/students/profile-verification/reports/${type}`, {
    params: { format: format === 'pdf' ? 'xlsx' : format },
    responseType: 'blob',
  });
  return data as Blob;
}
