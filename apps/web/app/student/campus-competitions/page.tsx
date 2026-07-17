'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Home, Loader2, Trophy } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import {
  StcEmptyState,
  StcHero,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchLeaderboard,
  fetchMeet,
  fetchMyHouse,
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
  const meetQ = useQuery({
    queryKey: ['campus-competitions', 'meet', selectedMeetId],
    queryFn: () => fetchMeet(selectedMeetId),
    enabled: Boolean(session && selectedMeetId),
  });
  const boardQ = useQuery({
    queryKey: ['campus-competitions', 'board', selectedMeetId],
    queryFn: () => fetchLeaderboard(selectedMeetId),
    enabled: Boolean(session && selectedMeetId),
    refetchInterval: 15_000,
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

  return (
    <DashboardShell role="student" title="Campus Competitions">
      <div className="space-y-5">
        <StcHero
          badge="Houses & Meets"
          title="Campus Competitions"
          subtitle="Your house, open meets, live leaderboard, and event registration."
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
          ) : !membership ? (
            <StcEmptyState
              icon={Home}
              title="Not allocated yet"
              description="The office will assign you to a house soon."
            />
          ) : (
            <div className="flex items-center gap-3">
              <span
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: membership.house?.color ?? '#2563eb' }}
              />
              <div>
                <p className="text-lg font-semibold">{membership.house?.name}</p>
                <p className="text-sm text-slate-500">{membership.house?.code}</p>
              </div>
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
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                  >
                    <p className="font-medium">{ev.name}</p>
                    <Button
                      size="sm"
                      type="button"
                      disabled={registerMut.isPending || !membership}
                      onClick={() => registerMut.mutate(ev.id)}
                    >
                      Register
                    </Button>
                  </div>
                ))}
            </div>
          </StcPanel>
        ) : null}

        {selectedMeetId ? (
          <StcPanel title="Leaderboard" icon={Award}>
            {(boardQ.data ?? []).map((row) => (
              <div
                key={row.id}
                className="mb-2 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
              >
                <span>
                  #{row.rank} {row.name}
                </span>
                <span className="font-semibold tabular-nums">{row.points}</span>
              </div>
            ))}
          </StcPanel>
        ) : null}
      </div>
    </DashboardShell>
  );
}
