import { apiFetch } from '@/api/client';

export type DeptActivity = {
  id: string;
  title: string;
  activityType: string;
  venue: string;
  eventDate: string;
  status: string;
  department?: { id: string; name: string; code: string } | null;
};

export type DeptActivityRegistration = {
  id: string;
  status: string;
  qrPassToken: string;
  registeredAt: string;
  activity?: DeptActivity | null;
};

export type TranscriptCertificate = {
  certificateLinkId: string;
  certificateType: string;
  certificateNo?: string | null;
  verifyUrl?: string | null;
  hasIntegritySeal?: boolean;
};

export type TranscriptEntry = {
  registrationId: string;
  attended: boolean;
  activity: {
    id: string;
    title: string;
    activityTypeLabel: string;
    eventDate: string;
    department?: { name: string } | null;
  };
  result?: { positionLabel: string } | null;
  certificates: TranscriptCertificate[];
};

export type ActivityTranscript = {
  summary: {
    total: number;
    attended: number;
    withCertificates: number;
    awards: number;
  };
  entries: TranscriptEntry[];
};

export type AchievementShareResult = {
  shareToken: string;
  shareUrl: string;
};

export function fetchOpenDepartmentActivities() {
  return apiFetch<DeptActivity[]>('/v1/department-activities/open');
}

export function fetchMyDepartmentActivityRegistrations() {
  return apiFetch<DeptActivityRegistration[]>('/v1/department-activities/mine');
}

export function registerForDepartmentActivity(activityId: string) {
  return apiFetch<DeptActivityRegistration>(`/v1/department-activities/${activityId}/register`, {
    method: 'POST',
  });
}

export function withdrawDepartmentActivity(activityId: string) {
  return apiFetch(`/v1/department-activities/${activityId}/withdraw`, {
    method: 'POST',
  });
}

export function fetchMyActivityTranscript() {
  return apiFetch<ActivityTranscript>('/v1/department-activities/me/transcript');
}

export function createAchievementShare(certificateLinkId: string) {
  return apiFetch<AchievementShareResult>(
    `/v1/department-activities/me/achievements/${certificateLinkId}/share`,
    { method: 'POST' },
  );
}
