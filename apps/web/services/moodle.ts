import { api } from './api';

export type MoodleSettings = {
  moodleUrl?: string | null;
  wsServiceName?: string | null;
  enableSync: boolean;
  enableAutoUserCreation: boolean;
  enableAutoCourseCreation: boolean;
  enableAutoEnrollment: boolean;
  enableGradeSync: boolean;
  enableAttendanceSync: boolean;
  enableAssignmentSync: boolean;
  enableNotificationSync: boolean;
  ssoEnabled: boolean;
  cronIntervalMinutes: number;
  connectionStatus: string;
  lastConnectionAt?: string | null;
  lastSyncAt?: string | null;
  hasWsToken?: boolean;
  hasSsoSecret?: boolean;
};

export type MoodleSyncDashboard = {
  settings: MoodleSettings;
  lastLogs: Array<{
    id: string;
    syncType: string;
    status: string;
    startedAt: string;
    finishedAt?: string | null;
    successCount?: number | null;
    failureCount?: number | null;
    errorMessage?: string | null;
  }>;
  pendingEvents: number;
  deadLetterCount?: number;
  queueStats?: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  counts: { courses: number; users: number; enrollments: number };
};

export type MoodleFailedJob = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  failedReason: string | null;
  attemptsMade: number;
  maxAttempts: number;
  finishedOn: number | null;
  timestamp: number;
};

export async function fetchMoodleSettings() {
  const { data } = await api.get('/v1/moodle/settings');
  return data as MoodleSettings;
}

export async function updateMoodleSettings(
  payload: Partial<MoodleSettings> & {
    wsToken?: string;
    ssoSecret?: string;
  },
) {
  const { data } = await api.post('/v1/moodle/settings', payload);
  return data as MoodleSettings;
}

export async function testMoodleConnection() {
  const { data } = await api.post('/v1/moodle/test-connection');
  return data;
}

export async function fetchMoodleSyncDashboard() {
  const { data } = await api.get('/v1/moodle/sync/dashboard');
  return data as MoodleSyncDashboard;
}

export async function runMoodleSync(syncType?: string) {
  const { data } = await api.post('/v1/moodle/sync/run', { syncType });
  return data;
}

export async function fetchMoodleSyncLogs() {
  const { data } = await api.get('/v1/moodle/sync/logs');
  return data;
}

export async function fetchMoodleFailedJobs() {
  const { data } = await api.get('/v1/moodle/sync/failed-jobs');
  return data as MoodleFailedJob[];
}

export async function requeueMoodleFailedJob(jobId: string) {
  const { data } = await api.post(`/v1/moodle/sync/failed-jobs/${jobId}/requeue`);
  return data as { requeued: boolean; jobId: string; name: string };
}

export async function requeueAllMoodleFailedJobs() {
  const { data } = await api.post('/v1/moodle/sync/failed-jobs/requeue-all');
  return data as { requeued: number };
}

export async function fetchMoodleApiLogs() {
  const { data } = await api.get('/v1/moodle/api/logs');
  return data;
}

export async function fetchLmsWorkspaceLaunchUrl(workspaceId: string) {
  const { data } = await api.get(`/v1/lms/me/workspaces/${workspaceId}/launch`);
  return data as { url: string | null };
}
