'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CalendarDays, Download, Loader2, Mic, QrCode } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  fetchPresentations,
  registerForActivity,
  submitPresentation,
  withdrawRegistration,
  type ActivityRegistration,
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

function RegistrationCard({
  reg,
  onMessage,
  withdrawPending,
  onWithdraw,
}: {
  reg: ActivityRegistration;
  onMessage: (msg: { tone: 'ok' | 'err'; text: string }) => void;
  withdrawPending: boolean;
  onWithdraw: () => void;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    topicTitle: '',
    abstractText: '',
    fileUrl: '',
    supervisor: '',
    keywords: '',
  });

  const presentationsQ = useQuery({
    queryKey: ['dept-activities', 'presentations', reg.activityId],
    queryFn: () => fetchPresentations(reg.activityId),
  });

  const myPresentation = useMemo(
    () => presentationsQ.data?.find((p) => p.registrationId === reg.id) ?? null,
    [presentationsQ.data, reg.id],
  );

  const submitMut = useMutation({
    mutationFn: () =>
      submitPresentation(reg.activityId, {
        topicTitle: form.topicTitle.trim(),
        abstractText: form.abstractText.trim() || undefined,
        fileUrl: form.fileUrl.trim() || undefined,
        supervisor: form.supervisor.trim() || undefined,
        keywords: form.keywords.trim() || undefined,
      }),
    onSuccess: () => {
      onMessage({ tone: 'ok', text: 'Presentation submitted for review.' });
      setShowForm(false);
      void qc.invalidateQueries({ queryKey: ['dept-activities'] });
    },
    onError: (e) =>
      onMessage({ tone: 'err', text: apiErrorMessage(e, 'Presentation submit failed') }),
  });

  const openForm = () => {
    if (myPresentation) {
      setForm({
        topicTitle: myPresentation.topicTitle ?? '',
        abstractText: myPresentation.abstractText ?? '',
        fileUrl: myPresentation.fileUrl ?? '',
        supervisor: myPresentation.supervisor ?? '',
        keywords: myPresentation.keywords ?? '',
      });
    }
    setShowForm(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
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
          <p className="mt-1 break-all font-mono text-sm text-slate-800">{reg.qrPassToken}</p>
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            <Mic className="h-3.5 w-3.5" />
            Presentation
          </p>
          {presentationsQ.isLoading ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : myPresentation ? (
            <StcStatusBadge status={myPresentation.status} />
          ) : null}
        </div>
        {myPresentation ? (
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-medium text-slate-800">{myPresentation.topicTitle}</p>
            {myPresentation.abstractText ? (
              <p className="line-clamp-2 text-xs text-slate-600">{myPresentation.abstractText}</p>
            ) : null}
            {myPresentation.reviewNote ? (
              <p className="text-xs text-slate-500">Reviewer note: {myPresentation.reviewNote}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Submit your topic and abstract if this activity requires a presentation.
          </p>
        )}
        {showForm ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitMut.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor={`topic-${reg.id}`}>Topic title</Label>
              <Input
                id={`topic-${reg.id}`}
                value={form.topicTitle}
                onChange={(e) => setForm((f) => ({ ...f, topicTitle: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`abstract-${reg.id}`}>Abstract</Label>
              <textarea
                id={`abstract-${reg.id}`}
                className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={form.abstractText}
                onChange={(e) => setForm((f) => ({ ...f, abstractText: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`file-${reg.id}`}>File URL</Label>
              <Input
                id={`file-${reg.id}`}
                value={form.fileUrl}
                onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`supervisor-${reg.id}`}>Supervisor</Label>
                <Input
                  id={`supervisor-${reg.id}`}
                  value={form.supervisor}
                  onChange={(e) => setForm((f) => ({ ...f, supervisor: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`keywords-${reg.id}`}>Keywords</Label>
                <Input
                  id={`keywords-${reg.id}`}
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" type="submit" disabled={submitMut.isPending}>
                {submitMut.isPending
                  ? 'Submitting…'
                  : myPresentation
                    ? 'Update submission'
                    : 'Submit'}
              </Button>
              <Button size="sm" type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button className="mt-3" size="sm" variant="outline" type="button" onClick={openForm}>
            {myPresentation ? 'Edit presentation' : 'Submit presentation'}
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          type="button"
          disabled={withdrawPending || Boolean(reg.attendance)}
          onClick={onWithdraw}
        >
          Withdraw
        </Button>
      </div>
    </div>
  );
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
            <div className="flex flex-col items-end gap-3">
              <Button size="sm" variant="secondary" type="button" asChild>
                <Link href="/student/department-activities/transcript">Activity transcript</Link>
              </Button>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left backdrop-blur">
                <p className="text-[11px] uppercase tracking-wide text-sky-100">Open now</p>
                <p className="text-2xl font-semibold tabular-nums">{openActivities.length}</p>
                <p className="text-xs text-slate-300">activities accepting registration</p>
              </div>
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
                <RegistrationCard
                  key={reg.id}
                  reg={reg}
                  onMessage={setMessage}
                  withdrawPending={withdrawMut.isPending}
                  onWithdraw={() => withdrawMut.mutate(reg.activityId)}
                />
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
