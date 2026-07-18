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
  displayToken?: string | null;
  liveEventId?: string | null;
  requireResultApproval?: boolean;
  pointRuleSet?: {
    firstPoints: number;
    secondPoints: number;
    thirdPoints: number;
    participationPoints: number;
  };
  events?: CompetitionEvent[];
  _count?: { events?: number };
};

export type CompetitionAnnouncement = {
  id: string;
  message: string;
  severity: string;
  createdAt: string;
};

export type CompetitionLiveBoard = {
  meet: {
    id: string;
    name: string;
    meetType: string;
    status: string;
    venue: string;
    theme: string;
    leaderboardVersion: number;
    displayToken?: string | null;
  };
  liveEvent: {
    id: string;
    name: string;
    status: string;
    scheduledAt?: string | null;
    entryMode: string;
  } | null;
  nextEvent: {
    id: string;
    name: string;
    status: string;
    scheduledAt?: string | null;
    entryMode: string;
  } | null;
  leaderboard: LeaderboardRow[];
  recentResults: Array<{
    position: number;
    metricValue: string | null;
    eventName: string;
    eventId: string;
    houseName: string | null;
    houseCode: string | null;
    houseColor: string | null;
  }>;
  announcements: CompetitionAnnouncement[];
  refreshedAt: string;
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

export async function seedDefaultHouses() {
  const { data } = await api.post(`${base}/houses/seed-defaults`, {});
  return data as {
    created: CompetitionHouse[];
    skipped: CompetitionHouse[];
    houses: CompetitionHouse[];
  };
}

export async function fetchHouse(houseId: string) {
  const { data } = await api.get(`${base}/houses/${houseId}`);
  return data as CompetitionHouse & {
    memberships: Array<{
      id: string;
      studentId: string;
      status: string;
      allocatedAt: string;
      student?: {
        id: string;
        enrollmentNumber: string;
        rollNumber?: string | null;
        fullName: string;
      } | null;
    }>;
    coordinators?: Array<{
      id: string;
      staffId: string;
      role: string;
      isPrimary: boolean;
      staff?: {
        id: string;
        employeeCode: string;
        fullName: string;
      } | null;
    }>;
  };
}

export async function setHouseStatus(houseId: string, status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') {
  const { data } = await api.post(`${base}/houses/${houseId}/status`, { status });
  return data as CompetitionHouse;
}

export async function mergeHouses(fromHouseId: string, intoHouseId: string) {
  const { data } = await api.post(`${base}/houses/${fromHouseId}/merge`, {
    intoHouseId,
  });
  return data;
}

export async function upsertHouseCoordinatorByKey(
  houseId: string,
  payload: { staffKey: string; role: string; isPrimary?: boolean },
) {
  const { data } = await api.post(`${base}/houses/${houseId}/coordinators/by-key`, payload);
  return data;
}

export async function removeHouseCoordinator(coordinatorId: string) {
  const { data } = await api.delete(`${base}/coordinators/${coordinatorId}`);
  return data;
}

export async function fetchCompetitionAcademicYears() {
  const { data } = await api.get(`${base}/academic-years`);
  return data as Array<{
    id: string;
    name: string;
    status: string;
    isPrimarySession?: boolean;
  }>;
}

export async function allocateByKeys(payload: {
  houseId: string;
  studentKeys: string[];
  academicYearId?: string;
}) {
  const { data } = await api.post(`${base}/allocations/by-keys`, payload);
  return data as { allocated: number };
}

export async function importHouseAllocations(
  rows: Array<{ studentKey: string; houseCode: string }>,
) {
  const { data } = await api.post(`${base}/allocations/import`, { rows });
  return data as { imported: number };
}

export async function transferByKey(payload: {
  studentKey: string;
  toHouseId: string;
  reason?: string;
}) {
  const { data } = await api.post(`${base}/transfers/by-key`, payload);
  return data;
}

export async function fetchEventFixtures(eventId: string) {
  const { data } = await api.get(`${base}/events/${eventId}/fixtures`);
  return data as Array<{
    id: string;
    round: string;
    heatNumber?: number | null;
    bracketSlot?: number | null;
    entryIds: string[] | unknown;
    status: string;
  }>;
}

export async function assignEventBibs(
  eventId: string,
  payload?: { startFrom?: number; force?: boolean },
) {
  const { data } = await api.post(`${base}/events/${eventId}/assign-bibs`, payload ?? {});
  return data as { assigned: number };
}

export async function createCompetitionTeam(payload: {
  eventId: string;
  houseId: string;
  name: string;
  memberKeys: string[];
}) {
  const { data } = await api.post(`${base}/teams`, payload);
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
  academicYearId?: string;
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

export async function fetchLiveBoard(meetId: string) {
  const { data } = await api.get(`${base}/meets/${meetId}/live`);
  return data as CompetitionLiveBoard;
}

export async function fetchPublicLiveBoard(token: string) {
  const { getApiBaseUrl } = await import('@/lib/http/env');
  const res = await fetch(
    `${getApiBaseUrl()}/v1/campus-competitions/display/${encodeURIComponent(token)}/live`,
    { cache: 'no-store' },
  );
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Display board not found' : 'Unable to load live board');
  }
  return (await res.json()) as CompetitionLiveBoard;
}

export async function ensureDisplayToken(meetId: string) {
  const { data } = await api.post(`${base}/meets/${meetId}/display-token`, {});
  return data as CompetitionMeet;
}

export async function setLiveEvent(meetId: string, liveEventId: string | null) {
  const { data } = await api.post(`${base}/meets/${meetId}/live-event`, { liveEventId });
  return data as CompetitionMeet;
}

export async function fetchAnnouncements(meetId: string) {
  const { data } = await api.get(`${base}/meets/${meetId}/announcements`);
  return data as CompetitionAnnouncement[];
}

export async function createAnnouncement(
  meetId: string,
  payload: { message: string; severity?: string },
) {
  const { data } = await api.post(`${base}/meets/${meetId}/announcements`, payload);
  return data as CompetitionAnnouncement;
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

export async function submitResultsForApproval(eventId: string) {
  const { data } = await api.post(`${base}/events/${eventId}/results/submit`, {});
  return data;
}

export async function approveResults(eventId: string) {
  const { data } = await api.post(`${base}/events/${eventId}/results/approve`, {});
  return data;
}

export async function fetchEventResults(eventId: string) {
  const { data } = await api.get(`${base}/events/${eventId}/results`);
  return data as Array<{
    id: string;
    position: number;
    status: string;
    metricValue?: string | null;
    entryId?: string | null;
    teamId?: string | null;
    entry?: {
      id: string;
      house?: { name: string; code: string; color: string } | null;
    } | null;
  }>;
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

export async function fetchMyEntries() {
  const { data } = await api.get(`${base}/mine`);
  return data as Array<{
    id: string;
    status: string;
    bibNumber?: string | null;
    qrPassToken?: string | null;
    house?: { id: string; name: string; code: string; color: string } | null;
    checkIns?: Array<{ method: string; markedAt: string }>;
    event?: {
      id: string;
      name: string;
      status: string;
      scheduledAt?: string | null;
      meet?: {
        id: string;
        name: string;
        meetType: string;
        status: string;
      } | null;
    } | null;
    results?: Array<{
      id: string;
      position: number;
      status: string;
      metricValue?: string | null;
    }>;
  }>;
}

export async function fetchMyMedals(meetId?: string) {
  const { data } = await api.get(`${base}/me/medals`, { params: { meetId } });
  return data as Array<{
    id: string;
    metal: string;
    awardType: string;
    createdAt: string;
    house?: { name: string; code: string; color: string } | null;
    meet?: { id: string; name: string; meetType: string } | null;
    event?: { id: string; name: string } | null;
  }>;
}

export async function fetchHouseDashboard(houseId: string, meetId?: string) {
  const { data } = await api.get(`${base}/houses/${houseId}/dashboard`, {
    params: { meetId },
  });
  return data as {
    house: { id: string; name: string; code: string; color: string };
    totalStudents: number;
    boys: number;
    girls: number;
    facultyCoordinators: number;
    championshipPoints: number;
    currentRank: number | null;
    medals: { gold: number; silver: number; bronze: number };
  };
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

export type ChampionshipStandings = {
  academicYearId: string;
  meetCount: number;
  meets: Array<{ id: string; name: string; status: string; meetType: string }>;
  standings: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    points: number;
    rank: number;
    medals: { gold: number; silver: number; bronze: number };
  }>;
  houseOfYear: {
    id: string;
    name: string;
    code: string;
    color: string;
    points: number;
    rank: number;
  } | null;
  awards: Array<{
    id: string;
    awardType: string;
    title: string;
    trophy?: { name: string; code: string; trophyType: string } | null;
    house?: { name: string; code: string; color: string } | null;
  }>;
};

export type CompetitionTrophy = {
  id: string;
  name: string;
  code: string;
  trophyType: string;
  status: string;
  description?: string;
  awards?: Array<{
    id: string;
    house?: { name: string; code: string } | null;
  }>;
};

export async function fetchChampionshipStandings(academicYearId: string) {
  const { data } = await api.get(`${base}/championship/${academicYearId}/standings`);
  return data as ChampionshipStandings;
}

export async function declareHouseOfYear(
  academicYearId: string,
  payload?: { houseId?: string; trophyId?: string; meetId?: string },
) {
  const { data } = await api.post(
    `${base}/championship/${academicYearId}/declare-house-of-year`,
    payload ?? {},
  );
  return data;
}

export async function fetchTrophies(status?: string) {
  const { data } = await api.get(`${base}/trophies`, { params: { status } });
  return data as CompetitionTrophy[];
}

export async function createTrophy(payload: {
  name: string;
  code: string;
  trophyType?: string;
  description?: string;
}) {
  const { data } = await api.post(`${base}/trophies`, payload);
  return data as CompetitionTrophy;
}

export async function awardTrophy(payload: {
  trophyId: string;
  academicYearId: string;
  awardType: string;
  houseId?: string;
  meetId?: string;
  title?: string;
}) {
  const { data } = await api.post(`${base}/trophies/award`, payload);
  return data;
}

export async function returnTrophyAward(awardId: string) {
  const { data } = await api.post(`${base}/trophy-awards/${awardId}/return`, {});
  return data;
}

export async function fetchEventCheckIns(eventId: string) {
  const { data } = await api.get(`${base}/events/${eventId}/check-ins`);
  return data as Array<{
    entryId: string;
    studentId: string | null;
    bibNumber: string | null;
    qrPassToken: string | null;
    house?: { name: string; code: string; color: string } | null;
    checkedIn: boolean;
    checkIn?: { method: string; markedAt: string; scanCode?: string | null } | null;
  }>;
}

export async function checkInEvent(
  eventId: string,
  payload: {
    entryId?: string;
    qrPassToken?: string;
    scanCode?: string;
    rfidNumber?: string;
    method?: string;
  },
) {
  const { data } = await api.post(`${base}/events/${eventId}/check-in`, payload);
  return data as { alreadyCheckedIn: boolean; checkIn: unknown; entry: unknown };
}

export async function ensureEventCheckInToken(eventId: string) {
  const { data } = await api.post(`${base}/events/${eventId}/check-in-token`, {});
  return data as { id: string; checkInToken?: string | null; name: string };
}

export async function publicEventCheckIn(
  eventId: string,
  token: string,
  payload: { scanCode?: string; qrPassToken?: string; rfidNumber?: string },
) {
  const { getApiBaseUrl } = await import('@/lib/http/env');
  const res = await fetch(
    `${getApiBaseUrl()}/v1/campus-competitions/public/events/${encodeURIComponent(eventId)}/check-in?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Check-in failed');
  }
  return res.json();
}
