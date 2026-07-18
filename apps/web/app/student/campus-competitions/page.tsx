'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Home, Loader2, Medal, Trophy } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { CompetitionLiveScoreboard } from '@/components/campus-competitions/competition-live-scoreboard';
import {
  StcEmptyState,
  StcHero,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { useRequireAuth } from '@/hooks/use-auth';
import { useCompetitionRealtime } from '@/hooks/use-competition-realtime';
import {
  fetchHouseDashboard,
  fetchLiveBoard,
  fetchMeet,
  fetchMyEntries,
  fetchMyHouse,
  fetchMyMedals,
  fetchOpenMeets,
  registerForEvent,
} from '@/services/campus-competitions';
import { apiErrorMessage } from '@/utils/api-error';

export default function StudentCampusCompetitionsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selectedMeetId, setSelectedMeetId] = useState('');

  const houseQ = useQuery({
    queryKey: ['campus-competitions', 'my-house'],
    queryFn: fetchMyHouse,
    enabled: Boolean(session),
  });
  const openQ = useQuery({
    queryKey: ['campus-competitions', 'open'],
    queryFn: fetchOpenMeets,
    enabled: Boolean(session),
  });
  const mineQ = useQuery({
    queryKey: ['campus-competitions', 'mine'],
    queryFn: fetchMyEntries,
    enabled: Boolean(session),
  });
  const medalsQ = useQuery({
    queryKey: ['campus-competitions', 'my-medals', selectedMeetId],
    queryFn: () => fetchMyMedals(selectedMeetId || undefined),
    enabled: Boolean(session),
  });
  const meetQ = useQuery({
    queryKey: ['campus-competitions', 'meet', selectedMeetId],
    queryFn: () => fetchMeet(selectedMeetId),
    enabled: Boolean(session && selectedMeetId),
  });
  const liveQ = useQuery({
    queryKey: ['campus-competitions', 'live', selectedMeetId],
    queryFn: () => fetchLiveBoard(selectedMeetId),
    enabled: Boolean(session && selectedMeetId),
    refetchInterval: 12_000,
  });

  const houseId = houseQ.data?.house?.id as string | undefined;
  const dashQ = useQuery({
    queryKey: ['campus-competitions', 'house-dash', houseId, selectedMeetId],
    queryFn: () => fetchHouseDashboard(houseId!, selectedMeetId || undefined),
    enabled: Boolean(session && houseId),
  });

  useCompetitionRealtime(selectedMeetId || null, {
    onLeaderboard: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'house-dash'] });
    },
    onResult: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'mine'] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'my-medals'] });
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'house-dash'] });
    },
    onAnnouncement: () => {
      void qc.invalidateQueries({ queryKey: ['campus-competitions', 'live', selectedMeetId] });
    },
  });

  const registerMut = useMutation({
    mutationFn: (eventId: string) => registerForEvent(eventId),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Registered for event.' });
      void qc.invalidateQueries({ queryKey: ['campus-competitions'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Registration failed') }),
  });

  if (!session) return null;

  const membership = houseQ.data;
  const openMeets = openQ.data ?? [];
  const myEntries = mineQ.data ?? [];
  const myMedals = medalsQ.data ?? [];
  const dash = dashQ.data;
  const registeredEventIds = new Set(myEntries.map((e) => e.event?.id).filter(Boolean));

  return (
    <DashboardShell role="student" title="Campus Competitions">
      <div className="space-y-5">
        <StcHero
          badge="Houses & Meets"
          title="Campus Competitions"
          subtitle="Your house, events, medals, and live leaderboard."
          actions={
            <Button size="sm" variant="secondary" type="button" asChild>
              <Link href="/student/certificates">Certificates</Link>
            </Button>
          }
        />

        {message ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              message.tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <StcPanel title="My house" icon={Home}>
          {houseQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : !membership?.house ? (
            <StcEmptyState
              icon={Home}
              title="Not allocated yet"
              description="The office will assign you to a house soon."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-8 w-8 rounded-full"
                  style={{ backgroundColor: membership.house.color ?? '#2563eb' }}
                />
                <div>
                  <p className="text-lg font-semibold">{membership.house.name}</p>
                  <p className="text-sm text-slate-500">{membership.house.code}</p>
                </div>
              </div>
              {dash ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Members</p>
                    <p className="font-semibold tabular-nums">{dash.totalStudents}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Rank</p>
                    <p className="font-semibold tabular-nums">
                      {dash.currentRank ? `#${dash.currentRank}` : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Points</p>
                    <p className="font-semibold tabular-nums">{dash.championshipPoints}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-500">Medals</p>
                    <p className="font-semibold tabular-nums">
                      G{dash.medals.gold} S{dash.medals.silver} B{dash.medals.bronze}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </StcPanel>

        <StcPanel title="My events" icon={Trophy} description="Your registrations and places">
          {mineQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : myEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No event registrations yet.</p>
          ) : (
            <div className="space-y-2">
              {myEntries.map((entry) => {
                const published = entry.results?.find((r) => r.status === 'PUBLISHED');
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      if (entry.event?.meet?.id) setSelectedMeetId(entry.event.meet.id);
                    }}
                  >
                    <div>
                      <p className="font-medium">{entry.event?.name ?? 'Event'}</p>
                      <p className="text-xs text-slate-500">
                        {entry.event?.meet?.name ?? '—'}
                        {published ? ` · Place #${published.position}` : ''}
                      </p>
                    </div>
                    <StcStatusBadge status={entry.status} />
                  </button>
                );
              })}
            </div>
          )}
        </StcPanel>

        <StcPanel title="My medals" icon={Medal}>
          {medalsQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : myMedals.length === 0 ? (
            <p className="text-sm text-slate-500">
              No medals yet — results publish after events finish.
            </p>
          ) : (
            <div className="space-y-2">
              {myMedals.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">
                      {m.metal} · {m.event?.name ?? 'Event'}
                    </p>
                    <p className="text-xs text-slate-500">{m.meet?.name ?? '—'}</p>
                  </div>
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: m.house?.color ?? '#94a3b8' }}
                  />
                </div>
              ))}
            </div>
          )}
        </StcPanel>

        <StcPanel title="Open meets" icon={Trophy}>
          {openMeets.length === 0 ? (
            <p className="text-sm text-slate-500">No open competitions right now.</p>
          ) : (
            <div className="space-y-2">
              {openMeets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left ${
                    selectedMeetId === m.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'
                  }`}
                  onClick={() => setSelectedMeetId(m.id)}
                >
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.meetType}</p>
                  </div>
                  <StcStatusBadge status={m.status} />
                </button>
              ))}
            </div>
          )}
        </StcPanel>

        {selectedMeetId && meetQ.data ? (
          <StcPanel title="Events" description="Register for individual events">
            <div className="space-y-2">
              {(meetQ.data.events ?? [])
                .filter((e) => e.entryMode === 'INDIVIDUAL')
                .map((ev) => {
                  const already = registeredEventIds.has(ev.id);
                  return (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                    >
                      <p className="font-medium">{ev.name}</p>
                      <Button
                        size="sm"
                        type="button"
                        disabled={registerMut.isPending || !membership?.house || already}
                        onClick={() => registerMut.mutate(ev.id)}
                      >
                        {already ? 'Registered' : 'Register'}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </StcPanel>
        ) : null}

        {selectedMeetId ? (
          <StcPanel title="Live board" icon={Award} description="Updates over Socket.IO">
            <CompetitionLiveScoreboard board={liveQ.data} loading={liveQ.isLoading} compact />
          </StcPanel>
        ) : null}
      </div>
    </DashboardShell>
  );
}
