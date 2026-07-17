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
};

export type LeaderboardRow = {
  id: string;
  name: string;
  code: string;
  points: number;
  rank: number;
};

export function fetchMyCompetitionHouse() {
  return apiFetch<CompetitionHouseMembership | null>('/v1/campus-competitions/me/house');
}

export function fetchOpenCompetitionMeets() {
  return apiFetch<CompetitionMeet[]>('/v1/campus-competitions/open');
}

export function fetchCompetitionLeaderboard(meetId: string) {
  return apiFetch<LeaderboardRow[]>(`/v1/campus-competitions/meets/${meetId}/leaderboard`);
}

export function registerForCompetitionEvent(eventId: string) {
  return apiFetch('/v1/campus-competitions/entries', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  });
}
