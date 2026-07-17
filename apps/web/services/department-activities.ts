import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

const base = '/v1/department-activities';

export const COMPETITION_POSITIONS = [
  'WINNER',
  'RUNNER_UP',
  'SECOND_RUNNER_UP',
  'SPECIAL_PRIZE',
  'CONSOLATION',
  'MERIT',
  'BEST_PRESENTER',
  'BEST_PAPER',
] as const;

export const MEDIA_TYPES = [
  'PHOTO',
  'VIDEO',
  'INVITATION',
  'BANNER',
  'ATTENDANCE',
  'REPORT',
  'PRESS_RELEASE',
  'CERTIFICATE',
  'OTHER',
] as const;

export type CompetitionPosition = (typeof COMPETITION_POSITIONS)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];

export type ActivityTypeDef = {
  code: string;
  label: string;
  icon: string;
  isCompetition: boolean;
};

export type DepartmentActivity = {
  id: string;
  title: string;
  departmentId: string;
  activityType: string;
  status: string;
  venue?: string | null;
  eventDate: string;
  registrationStartsAt?: string | null;
  registrationEndsAt?: string | null;
  maxParticipants?: number | null;
  description?: string | null;
  attendanceFinalized?: boolean;
  reportText?: string | null;
  outcomesSummary?: string | null;
  feedbackSummary?: string | null;
  department?: { id: string; name: string; code: string };
  _count?: { registrations: number; certificateLinks?: number };
  registrationCount?: number;
  attendanceCount?: number;
};

export type ActivityResult = {
  id: string;
  activityId: string;
  registrationId: string;
  position: string;
  remarks?: string | null;
  recordedAt?: string | null;
  registration?: ActivityRegistration;
};

export type ActivityPresentation = {
  id: string;
  activityId: string;
  registrationId: string;
  topicTitle: string;
  abstractText?: string | null;
  fileUrl?: string | null;
  supervisor?: string | null;
  keywords?: string | null;
  status: string;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
  registration?: ActivityRegistration;
};

export type ActivityMedia = {
  id: string;
  activityId: string;
  mediaType: string;
  title?: string | null;
  url: string;
  createdAt?: string | null;
};

export type ReportsSummary = {
  byStatus: Record<string, number>;
  byActivityType: Record<string, number>;
  participants: number;
  certificates: number;
  winners: number;
};

export type ResultItemPayload = {
  registrationId: string;
  position: string;
  remarks?: string;
};

export type SubmitPresentationPayload = {
  topicTitle: string;
  abstractText?: string;
  fileUrl?: string;
  supervisor?: string;
  keywords?: string;
};

export type AddMediaPayload = {
  mediaType: string;
  url: string;
  title?: string;
};

export type UpdateActivityReportPayload = {
  reportText?: string;
  outcomesSummary?: string;
  feedbackSummary?: string;
};

export type ActivityRegistration = {
  id: string;
  activityId: string;
  studentId: string;
  status: string;
  qrPassToken?: string | null;
  registeredAt?: string | null;
  student?: {
    id: string;
    enrollmentNumber?: string | null;
    rollNumber?: string | null;
    admissionNumber?: string | null;
    masterProfile?: { fullName?: string | null };
    user?: { displayName?: string | null; email?: string | null };
  };
  attendance?: { id: string; method?: string; markedAt?: string } | null;
  activity?: DepartmentActivity;
};

export type ActivityDashboard = {
  upcoming: number;
  completed: number;
  participants: number;
  certificates: number;
  pendingApproval: number;
};

export type UpsertActivityPayload = {
  title: string;
  departmentId: string;
  activityType: string;
  eventDate: string;
  venue?: string;
  maxParticipants?: number;
  description?: string;
  registrationStartsAt?: string;
  registrationEndsAt?: string;
};

export async function fetchActivityTypes(): Promise<ActivityTypeDef[]> {
  const { data } = await api.get(`${base}/types`);
  return data;
}

export async function fetchDashboard(): Promise<ActivityDashboard> {
  const { data } = await api.get(`${base}/dashboard`);
  return data;
}

export async function fetchActivities(params?: {
  departmentId?: string;
  status?: string;
  upcoming?: boolean;
}): Promise<DepartmentActivity[]> {
  const { data } = await api.get(base, {
    params: params
      ? {
          ...params,
          upcoming: params.upcoming ? 'true' : undefined,
        }
      : undefined,
  });
  return data;
}

export async function fetchActivity(id: string): Promise<DepartmentActivity> {
  const { data } = await api.get(`${base}/${id}`);
  return data;
}

export async function createActivity(payload: UpsertActivityPayload) {
  const { data } = await api.post(base, payload);
  return data;
}

export async function updateActivity(id: string, payload: UpsertActivityPayload) {
  const { data } = await api.patch(`${base}/${id}`, payload);
  return data;
}

export async function transitionStatus(id: string, status: string) {
  const { data } = await api.post(`${base}/${id}/status`, { status });
  return data;
}

export async function fetchOpenActivities(): Promise<DepartmentActivity[]> {
  const { data } = await api.get(`${base}/open`);
  return data;
}

export async function fetchMyRegistrations(): Promise<ActivityRegistration[]> {
  const { data } = await api.get(`${base}/mine`);
  return data;
}

export async function registerForActivity(id: string) {
  const { data } = await api.post(`${base}/${id}/register`, {});
  return data;
}

export async function withdrawRegistration(id: string) {
  const { data } = await api.post(`${base}/${id}/withdraw`, {});
  return data;
}

export async function fetchRegistrations(activityId: string): Promise<ActivityRegistration[]> {
  const { data } = await api.get(`${base}/${activityId}/registrations`);
  return data;
}

export async function markAttendance(
  activityId: string,
  payload: { registrationId?: string; qrPassToken?: string; method?: string },
) {
  const { data } = await api.post(`${base}/${activityId}/attendance`, payload);
  return data;
}

export async function finalizeAttendance(activityId: string) {
  const { data } = await api.post(`${base}/${activityId}/attendance/finalize`, {});
  return data;
}

export async function issueParticipationCertificates(activityId: string) {
  const { data } = await api.post(`${base}/${activityId}/certificates/participation`, {});
  return data;
}

export async function fetchReportsSummary(params?: {
  departmentId?: string;
  from?: string;
  to?: string;
}): Promise<ReportsSummary> {
  const { data } = await api.get(`${base}/reports/summary`, { params });
  return data;
}

export async function downloadReportsCsv(params?: {
  departmentId?: string;
  from?: string;
  to?: string;
}) {
  const res = await api.get(`${base}/reports/csv`, { params, responseType: 'blob' });
  downloadBlob(res.data as Blob, 'department-activities-report.csv');
}

export async function fetchActivityResults(activityId: string): Promise<ActivityResult[]> {
  const { data } = await api.get(`${base}/${activityId}/results`);
  return data;
}

export async function saveActivityResults(
  activityId: string,
  results: ResultItemPayload[],
): Promise<ActivityResult[]> {
  const { data } = await api.put(`${base}/${activityId}/results`, { results });
  return data;
}

export async function issueAwardCertificates(activityId: string) {
  const { data } = await api.post(`${base}/${activityId}/certificates/awards`, {});
  return data;
}

export async function fetchPresentations(activityId: string): Promise<ActivityPresentation[]> {
  const { data } = await api.get(`${base}/${activityId}/presentations`);
  return data;
}

export async function submitPresentation(
  activityId: string,
  payload: SubmitPresentationPayload,
): Promise<ActivityPresentation> {
  const { data } = await api.post(`${base}/${activityId}/presentations`, payload);
  return data;
}

export async function reviewPresentation(
  presentationId: string,
  payload: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string },
): Promise<ActivityPresentation> {
  const { data } = await api.post(`${base}/presentations/${presentationId}/review`, payload);
  return data;
}

export async function fetchActivityMedia(activityId: string): Promise<ActivityMedia[]> {
  const { data } = await api.get(`${base}/${activityId}/media`);
  return data;
}

export async function addActivityMedia(
  activityId: string,
  payload: AddMediaPayload,
): Promise<ActivityMedia> {
  const { data } = await api.post(`${base}/${activityId}/media`, payload);
  return data;
}

export async function deleteActivityMedia(mediaId: string) {
  const { data } = await api.delete(`${base}/media/${mediaId}`);
  return data;
}

export async function updateActivityReport(
  activityId: string,
  payload: UpdateActivityReportPayload,
): Promise<DepartmentActivity> {
  const { data } = await api.patch(`${base}/${activityId}/report`, payload);
  return data;
}

export function positionLabel(position: string) {
  return position
    .split('_')
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(' ');
}
