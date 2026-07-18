import { apiFetch } from '@/api/client';

export type CompetitionHouseMembership = {
  id: string;
  house?: { id: string; name: string; code: string; color: string } | null;
};

export type CompetitionMeet = {
  id: string;
  name: string;
  meetType: string;
  status: string;
  events?: CompetitionEvent[];
};

export type CompetitionEvent = {
  id: string;
  name: string;
  entryMode: string;
  status: string;
};

export type LeaderboardRow = {
  id: string;
  name: string;
  code: string;
  points: number;
  rank: number;
  medals?: { gold: number; silver: number; bronze: number };
};

export type CompetitionEntry = {
  id: string;
  status: string;
  bibNumber?: string | null;
  qrPassToken?: string | null;
  checkIns?: Array<{ method: string; markedAt: string }>;
  event?: {
    id: string;
    name: string;
    meet?: { id: string; name: string } | null;
  } | null;
  results?: Array<{ position: number; status: string }>;
};

export type CompetitionMedal = {
  id: string;
  metal: string;
  meet?: { name: string } | null;
  event?: { name: string } | null;
};

export type CompetitionHouseDashboard = {
  totalStudents: number;
  championshipPoints: number;
  currentRank: number | null;
  medals: { gold: number; silver: number; bronze: number };
};

export function fetchMyCompetitionHouse() {
  return apiFetch<CompetitionHouseMembership | null>('/v1/campus-competitions/me/house');
}

export function fetchOpenCompetitionMeets() {
  return apiFetch<CompetitionMeet[]>('/v1/campus-competitions/open');
}

export function fetchCompetitionMeet(meetId: string) {
  return apiFetch<CompetitionMeet>(`/v1/campus-competitions/meets/${meetId}`);
}

export function fetchCompetitionLeaderboard(meetId: string) {
  return apiFetch<LeaderboardRow[]>(`/v1/campus-competitions/meets/${meetId}/leaderboard`);
}

export function fetchMyCompetitionEntries() {
  return apiFetch<CompetitionEntry[]>('/v1/campus-competitions/mine');
}

export function fetchMyCompetitionMedals(meetId?: string) {
  const q = meetId ? `?meetId=${encodeURIComponent(meetId)}` : '';
  return apiFetch<CompetitionMedal[]>(`/v1/campus-competitions/me/medals${q}`);
}

export function fetchCompetitionHouseDashboard(houseId: string, meetId?: string) {
  const q = meetId ? `?meetId=${encodeURIComponent(meetId)}` : '';
  return apiFetch<CompetitionHouseDashboard>(
    `/v1/campus-competitions/houses/${houseId}/dashboard${q}`,
  );
}

export function fetchCompetitionAcademicYears() {
  return apiFetch<
    Array<{
      id: string;
      name: string;
      status: string;
      isPrimarySession?: boolean;
    }>
  >('/v1/campus-competitions/academic-years');
}

export function fetchMyCompetitionSchedule() {
  return apiFetch<
    Array<{
      entryId: string;
      bibNumber?: string | null;
      lane?: number | null;
      event?: {
        id: string;
        name: string;
        meet?: { id: string; name: string } | null;
      } | null;
      fixtures: Array<{
        id: string;
        round: string;
        heatNumber?: number | null;
        bracketSlot?: number | null;
        scheduledAt?: string | null;
        status: string;
      }>;
    }>
  >('/v1/campus-competitions/me/schedule');
}

export function fetchChampionshipStandings(academicYearId: string) {
  return apiFetch<{
    meetCount: number;
    houseOfYear?: { id: string; name: string; code: string; color: string } | null;
    standings: Array<{
      id: string;
      name: string;
      code: string;
      color: string;
      points: number;
      rank: number;
      medals?: { gold: number; silver: number; bronze: number };
    }>;
  }>(`/v1/campus-competitions/championship/${academicYearId}/standings`);
}

export function registerForCompetitionEvent(eventId: string) {
  return apiFetch('/v1/campus-competitions/entries', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  });
}
