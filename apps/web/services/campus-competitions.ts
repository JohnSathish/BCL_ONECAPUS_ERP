import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

const base = '/v1/campus-competitions';

export type CompetitionHouse = {
  id: string;
  name: string;
  code: string;
  color: string;
  motto?: string;
  status: string;
  _count?: { memberships?: number };
};

export type CompetitionMeet = {
  id: string;
  name: string;
  meetType: string;
  venue?: string;
  startsAt: string;
  endsAt: string;
  status: string;
  leaderboardVersion?: number;
  theme?: string;
  pointRuleSet?: {
    firstPoints: number;
    secondPoints: number;
    thirdPoints: number;
    participationPoints: number;
  };
  events?: CompetitionEvent[];
  _count?: { events?: number };
};

export type CompetitionEvent = {
  id: string;
  meetId: string;
  name: string;
  entryMode: string;
  gender?: string;
  status: string;
  scheduledAt?: string | null;
  category?: { code: string; label: string; groupCode: string } | null;
  _count?: { entries?: number };
};

export type LeaderboardRow = {
  id: string;
  name: string;
  code: string;
  color: string;
  points: number;
  rank: number;
  medals: { gold: number; silver: number; bronze: number };
};

export async function fetchMeetTypes() {
  const { data } = await api.get(`${base}/meet-types`);
  return data as Array<{ code: string; label: string }>;
}

export async function fetchHouses(status?: string) {
  const { data } = await api.get(`${base}/houses`, { params: { status } });
  return data as CompetitionHouse[];
}

export async function createHouse(payload: {
  name: string;
  code: string;
  color?: string;
  motto?: string;
}) {
  const { data } = await api.post(`${base}/houses`, payload);
  return data as CompetitionHouse;
}

export async function autoAllocateHouses(payload?: { academicYearId?: string }) {
  const { data } = await api.post(`${base}/allocations/auto`, payload ?? {});
  return data;
}

export async function fetchMeets(status?: string) {
  const { data } = await api.get(`${base}/meets`, { params: { status } });
  return data as CompetitionMeet[];
}

export async function createMeet(payload: {
  name: string;
  meetType: string;
  startsAt: string;
  endsAt: string;
  venue?: string;
  theme?: string;
}) {
  const { data } = await api.post(`${base}/meets`, payload);
  return data as CompetitionMeet;
}

export async function fetchMeet(id: string) {
  const { data } = await api.get(`${base}/meets/${id}`);
  return data as CompetitionMeet;
}

export async function transitionMeetStatus(id: string, status: string) {
  const { data } = await api.post(`${base}/meets/${id}/status`, { status });
  return data as CompetitionMeet;
}

export async function createEvent(
  meetId: string,
  payload: {
    name: string;
    categoryId?: string;
    entryMode?: string;
    gender?: string;
  },
) {
  const { data } = await api.post(`${base}/meets/${meetId}/events`, payload);
  return data as CompetitionEvent;
}

export async function fetchLeaderboard(meetId: string) {
  const { data } = await api.get(`${base}/meets/${meetId}/leaderboard`);
  return data as LeaderboardRow[];
}

export async function upsertResults(
  eventId: string,
  results: Array<{ entryId?: string; teamId?: string; position: number; metricValue?: string }>,
  publish?: boolean,
) {
  const { data } = await api.put(`${base}/events/${eventId}/results`, { results, publish });
  return data;
}

export async function publishResults(eventId: string) {
  const { data } = await api.post(`${base}/events/${eventId}/results/publish`, {});
  return data;
}

export async function fetchEventEntries(eventId: string) {
  const { data } = await api.get(`${base}/events/${eventId}/entries`);
  return data;
}

export async function generateFixtures(eventId: string, mode?: string) {
  const { data } = await api.post(`${base}/events/${eventId}/fixtures`, { mode });
  return data;
}

export async function issueParticipationCertificates(meetId: string) {
  const { data } = await api.post(`${base}/meets/${meetId}/certificates/participation`, {});
  return data;
}

export async function issuePlaceCertificates(meetId: string) {
  const { data } = await api.post(`${base}/meets/${meetId}/certificates/places`, {});
  return data;
}

export async function downloadMeetReportCsv(meetId: string) {
  const res = await api.get(`${base}/meets/${meetId}/reports/csv`, { responseType: 'blob' });
  downloadBlob(res.data as Blob, `competition-meet-${meetId}.csv`);
}

export async function fetchMyHouse() {
  const { data } = await api.get(`${base}/me/house`);
  return data;
}

export async function fetchOpenMeets() {
  const { data } = await api.get(`${base}/open`);
  return data as CompetitionMeet[];
}

export async function registerForEvent(eventId: string) {
  const { data } = await api.post(`${base}/entries`, { eventId });
  return data;
}

export async function updatePointRules(
  meetId: string,
  payload: {
    firstPoints?: number;
    secondPoints?: number;
    thirdPoints?: number;
    participationPoints?: number;
  },
) {
  const { data } = await api.put(`${base}/meets/${meetId}/point-rules`, payload);
  return data;
}
