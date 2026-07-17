'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarDays, Download, Loader2, QrCode } from 'lucide-react';
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
  fetchMyRegistrations,
  fetchOpenActivities,
  registerForActivity,
  withdrawRegistration,
} from '@/services/department-activities';
import { apiErrorMessage } from '@/utils/api-error';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentDepartmentActivitiesPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const openQ = useQuery({
    queryKey: ['dept-activities', 'open'],
    queryFn: fetchOpenActivities,
    enabled: Boolean(session),
  });
  const mineQ = useQuery({
    queryKey: ['dept-activities', 'mine'],
    queryFn: fetchMyRegistrations,
    enabled: Boolean(session),
  });

  const registerMut = useMutation({
    mutationFn: registerForActivity,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Registered successfully. Your QR pass is ready below.' });
      void qc.invalidateQueries({ queryKey: ['dept-activities'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Registration failed') }),
  });

  const withdrawMut = useMutation({
    mutationFn: withdrawRegistration,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Registration withdrawn.' });
      void qc.invalidateQueries({ queryKey: ['dept-activities'] });
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Withdraw failed') }),
  });

  if (!session) return null;

  const openActivities = openQ.data ?? [];
  const myRegistrations = mineQ.data ?? [];
  const registeredIds = new Set(myRegistrations.map((r) => r.activityId));

  return (
    <DashboardShell role="student" title="Department Activities">
      <div className="space-y-5">
        <StcHero
          badge="Campus Events"
          title="Department Activities"
          subtitle="Register for seminars, workshops, and competitions. Show your QR pass at the venue for attendance."
          actions={
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left backdrop-blur">
              <p className="text-[11px] uppercase tracking-wide text-sky-100">Open now</p>
              <p className="text-2xl font-semibold tabular-nums">{openActivities.length}</p>
              <p className="text-xs text-slate-300">activities accepting registration</p>
            </div>
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

        <StcPanel
          title="Open activities"
          description="Register before the window closes or capacity is reached"
          icon={CalendarDays}
        >
          {openQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading open activities…
            </div>
          ) : openActivities.length === 0 ? (
            <StcEmptyState
              icon={CalendarDays}
              title="No open activities"
              description="When your department opens registration for an event, it will appear here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {openActivities.map((activity) => {
                const alreadyRegistered = registeredIds.has(activity.id);
                const seats =
                  activity.maxParticipants != null
                    ? `${activity._count?.registrations ?? 0} / ${activity.maxParticipants}`
                    : `${activity._count?.registrations ?? 0} registered`;
                return (
                  <article
                    key={activity.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold text-slate-900">{activity.title}</h2>
                        <p className="mt-1 text-xs text-slate-500">
                          {activity.department?.name ?? 'Department'} ·{' '}
                          {formatDate(activity.eventDate)}
                        </p>
                      </div>
                      <StcStatusBadge status="OPEN" />
                    </div>
                    {activity.description ? (
                      <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                        {activity.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500">
                      {activity.venue ? `${activity.venue} · ` : ''}
                      {seats}
                    </p>
                    <Button
                      className="mt-4 w-full"
                      type="button"
                      variant={alreadyRegistered ? 'outline' : 'default'}
                      disabled={alreadyRegistered || registerMut.isPending || withdrawMut.isPending}
                      onClick={() => registerMut.mutate(activity.id)}
                    >
                      {registerMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registering…
                        </>
                      ) : alreadyRegistered ? (
                        'Registered'
                      ) : (
                        'Register'
                      )}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </StcPanel>

        <StcPanel
          title="My registrations"
          description="QR pass tokens for venue check-in"
          icon={QrCode}
        >
          {mineQ.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your registrations…
            </div>
          ) : myRegistrations.length === 0 ? (
            <StcEmptyState
              icon={QrCode}
              title="No registrations yet"
              description="Browse open activities above and register to receive your QR pass."
            />
          ) : (
            <div className="space-y-3">
              {myRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{reg.activity?.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {reg.activity?.department?.name} · {formatDate(reg.activity?.eventDate)}
                      </p>
                    </div>
                    {reg.attendance ? (
                      <StcStatusBadge status="CONFIRMED" />
                    ) : (
                      <StcStatusBadge status={reg.status} />
                    )}
                  </div>
                  {reg.qrPassToken ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        QR pass token
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-slate-800">
                        {reg.qrPassToken}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={withdrawMut.isPending || Boolean(reg.attendance)}
                      onClick={() => withdrawMut.mutate(reg.activityId)}
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </StcPanel>

        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-sm ring-1 ring-amber-100/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Award className="h-4 w-4 text-amber-600" />
                Participation certificates
              </p>
              <p className="mt-2 text-sm text-slate-600">
                After attendance is finalized, your participation certificate will appear in your
                certificates vault.
              </p>
            </div>
            <Button size="sm" variant="outline" type="button" asChild>
              <Link href="/student/certificates">
                <Download className="mr-1 h-3.5 w-3.5" />
                Open certificates
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
