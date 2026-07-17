'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  StcEmptyState,
  StcHero,
  StcKpiCard,
  StcPanel,
  StcStatusBadge,
} from '@/components/short-term-courses/stc-shared';
import { fetchDepartments } from '@/services/organization';
import {
  createActivity,
  fetchActivities,
  fetchActivityTypes,
  fetchDashboard,
  fetchRegistrations,
  finalizeAttendance,
  issueParticipationCertificates,
  markAttendance,
  transitionStatus,
  type UpsertActivityPayload,
} from '@/services/department-activities';
import { apiErrorMessage } from '@/utils/api-error';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'activities', label: 'Activities', icon: CalendarDays },
  { id: 'create', label: 'Create', icon: Plus },
] as const;

type Tab = (typeof TABS)[number]['id'];

const STATUS_ACTIONS: Record<string, { label: string; next: string } | undefined> = {
  DRAFT: { label: 'Submit', next: 'PENDING_APPROVAL' },
  PENDING_APPROVAL: { label: 'Approve', next: 'APPROVED' },
  APPROVED: { label: 'Open', next: 'OPEN' },
  OPEN: { label: 'Close', next: 'CLOSED' },
  CLOSED: { label: 'Complete', next: 'COMPLETED' },
};

function studentName(reg: {
  student?: {
    masterProfile?: { fullName?: string | null };
    user?: { displayName?: string | null };
    enrollmentNumber?: string | null;
  };
}) {
  return (
    reg.student?.masterProfile?.fullName ??
    reg.student?.user?.displayName ??
    reg.student?.enrollmentNumber ??
    'Student'
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const emptyForm: UpsertActivityPayload = {
  title: '',
  departmentId: '',
  activityType: '',
  eventDate: '',
  venue: '',
  maxParticipants: undefined,
  description: '',
  registrationStartsAt: '',
  registrationEndsAt: '',
};

export function DepartmentActivitiesWorkspace() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<UpsertActivityPayload>(emptyForm);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['dept-activities'] });

  const dashQ = useQuery({
    queryKey: ['dept-activities', 'dashboard'],
    queryFn: fetchDashboard,
  });
  const activitiesQ = useQuery({
    queryKey: ['dept-activities', 'list'],
    queryFn: () => fetchActivities(),
  });
  const typesQ = useQuery({
    queryKey: ['dept-activities', 'types'],
    queryFn: fetchActivityTypes,
  });
  const departmentsQ = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchDepartments({ scope: 'academic', status: 'ACTIVE' }),
  });
  const registrationsQ = useQuery({
    queryKey: ['dept-activities', 'registrations', selectedId],
    queryFn: () => fetchRegistrations(selectedId),
    enabled: Boolean(selectedId),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => transitionStatus(id, status),
    onSuccess: (_data, vars) => {
      setMessage({
        tone: 'ok',
        text: `Activity moved to ${vars.status.replace(/_/g, ' ').toLowerCase()}.`,
      });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Status update failed') }),
  });

  const createMut = useMutation({
    mutationFn: createActivity,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Activity created as draft.' });
      setForm(emptyForm);
      setTab('activities');
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Create failed') }),
  });

  const markMut = useMutation({
    mutationFn: ({ activityId, registrationId }: { activityId: string; registrationId: string }) =>
      markAttendance(activityId, { registrationId, method: 'MANUAL' }),
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Attendance marked present.' });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Attendance failed') }),
  });

  const finalizeMut = useMutation({
    mutationFn: finalizeAttendance,
    onSuccess: () => {
      setMessage({ tone: 'ok', text: 'Attendance finalized.' });
      invalidate();
    },
    onError: (e) => setMessage({ tone: 'err', text: apiErrorMessage(e, 'Finalize failed') }),
  });

  const certMut = useMutation({
    mutationFn: issueParticipationCertificates,
    onSuccess: (res) => {
      setMessage({
        tone: 'ok',
        text: `Issued ${res.issued ?? 0} participation certificate(s).`,
      });
      invalidate();
    },
    onError: (e) =>
      setMessage({ tone: 'err', text: apiErrorMessage(e, 'Certificate issue failed') }),
  });

  const activities = activitiesQ.data ?? [];
  const selected = useMemo(
    () => activities.find((a) => a.id === selectedId) ?? null,
    [activities, selectedId],
  );
  const registrations = registrationsQ.data ?? [];
  const types = typesQ.data ?? [];
  const departments = departmentsQ.data ?? [];
  const dash = dashQ.data;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpsertActivityPayload = {
      title: form.title.trim(),
      departmentId: form.departmentId,
      activityType: form.activityType,
      eventDate: form.eventDate,
      venue: form.venue?.trim() || undefined,
      description: form.description?.trim() || undefined,
      maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
      registrationStartsAt: form.registrationStartsAt || undefined,
      registrationEndsAt: form.registrationEndsAt || undefined,
    };
    createMut.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <StcHero
        badge="Department Events"
        title="Department Activities"
        subtitle="Plan seminars, workshops, and competitions — approve, open registration, mark attendance, and issue participation certificates."
      />

      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 opacity-80" />
              {item.label}
            </button>
          );
        })}
      </nav>

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

      {tab === 'dashboard' ? (
        dashQ.isLoading ? (
          <LoadingBlock label="Loading dashboard…" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StcKpiCard
              label="Upcoming"
              value={dash?.upcoming ?? 0}
              hint="Approved or open events"
              icon={CalendarDays}
              tone="from-sky-50 to-white"
            />
            <StcKpiCard
              label="Completed"
              value={dash?.completed ?? 0}
              icon={ClipboardCheck}
              tone="from-violet-50 to-white"
            />
            <StcKpiCard
              label="Participants"
              value={dash?.participants ?? 0}
              hint="Active registrations"
              icon={Users}
              tone="from-emerald-50 to-white"
            />
            <StcKpiCard
              label="Certificates"
              value={dash?.certificates ?? 0}
              icon={Award}
              tone="from-amber-50 to-white"
            />
            <StcKpiCard
              label="Pending approval"
              value={dash?.pendingApproval ?? 0}
              icon={LayoutDashboard}
              tone="from-orange-50 to-white"
            />
          </div>
        )
      ) : null}

      {tab === 'activities' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr,minmax(280px,360px)]">
          <StcPanel
            title="Activities"
            description="All department events in your scope"
            icon={CalendarDays}
          >
            {activitiesQ.isLoading ? (
              <LoadingBlock label="Loading activities…" />
            ) : activities.length === 0 ? (
              <StcEmptyState
                icon={CalendarDays}
                title="No activities yet"
                description="Create a draft activity and submit it for approval."
                action={
                  <Button type="button" onClick={() => setTab('create')}>
                    Create activity
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 font-semibold">Title</th>
                      <th className="px-2 py-2 font-semibold">Department</th>
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Date</th>
                      <th className="px-2 py-2 font-semibold">Status</th>
                      <th className="px-2 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => {
                      const typeLabel =
                        types.find((t) => t.code === activity.activityType)?.label ??
                        activity.activityType;
                      const statusAction = STATUS_ACTIONS[activity.status];
                      const canManageAttendance = ['OPEN', 'CLOSED', 'COMPLETED'].includes(
                        activity.status,
                      );
                      return (
                        <tr
                          key={activity.id}
                          className={`border-b border-slate-100 ${
                            selectedId === activity.id ? 'bg-sky-50/60' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              className="font-medium text-slate-900 hover:underline"
                              onClick={() => setSelectedId(activity.id)}
                            >
                              {activity.title}
                            </button>
                          </td>
                          <td className="px-2 py-3 text-slate-600">
                            {activity.department?.name ?? activity.departmentId.slice(0, 8)}
                          </td>
                          <td className="px-2 py-3 text-slate-600">{typeLabel}</td>
                          <td className="px-2 py-3 text-slate-600">
                            {formatDate(activity.eventDate)}
                          </td>
                          <td className="px-2 py-3">
                            <StcStatusBadge status={activity.status} />
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex flex-wrap gap-1">
                              {statusAction ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                  disabled={statusMut.isPending}
                                  onClick={() =>
                                    statusMut.mutate({
                                      id: activity.id,
                                      status: statusAction.next,
                                    })
                                  }
                                >
                                  {statusAction.label}
                                </Button>
                              ) : null}
                              {canManageAttendance ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  type="button"
                                  onClick={() => setSelectedId(activity.id)}
                                >
                                  Attendance
                                </Button>
                              ) : null}
                              {activity.status === 'COMPLETED' || activity.attendanceFinalized ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  type="button"
                                  onClick={() => setSelectedId(activity.id)}
                                >
                                  Certificates
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </StcPanel>

          <Card className="h-fit border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {selected ? selected.title : 'Activity detail'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <p className="text-sm text-slate-500">
                  Select an activity to view registrations, mark attendance, and issue certificates.
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Status</dt>
                      <dd className="mt-0.5">
                        <StcStatusBadge status={selected.status} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Event date</dt>
                      <dd className="mt-0.5 font-medium">{formatDate(selected.eventDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Registered</dt>
                      <dd className="mt-0.5 font-medium">
                        {selected._count?.registrations ?? selected.registrationCount ?? 0}
                        {selected.maxParticipants ? ` / ${selected.maxParticipants}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Attendance</dt>
                      <dd className="mt-0.5 font-medium">
                        {selected.attendanceCount ?? 0}
                        {selected.attendanceFinalized ? ' (finalized)' : ''}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    {!selected.attendanceFinalized &&
                    ['OPEN', 'CLOSED', 'COMPLETED'].includes(selected.status) ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        disabled={finalizeMut.isPending}
                        onClick={() => finalizeMut.mutate(selected.id)}
                      >
                        Finalize Attendance
                      </Button>
                    ) : null}
                    {selected.attendanceFinalized ? (
                      <Button
                        size="sm"
                        type="button"
                        disabled={certMut.isPending}
                        onClick={() => certMut.mutate(selected.id)}
                      >
                        Issue Participation Certificates
                      </Button>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Roster
                    </p>
                    {registrationsQ.isLoading ? (
                      <LoadingBlock label="Loading roster…" />
                    ) : registrations.length === 0 ? (
                      <p className="text-sm text-slate-500">No registrations yet.</p>
                    ) : (
                      <ul className="max-h-72 space-y-2 overflow-y-auto">
                        {registrations
                          .filter((r) => r.status === 'REGISTERED')
                          .map((reg) => (
                            <li
                              key={reg.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 px-3 py-2 text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-900">{studentName(reg)}</p>
                                <p className="text-xs text-slate-500">
                                  {reg.student?.enrollmentNumber ?? reg.student?.rollNumber ?? '—'}
                                </p>
                              </div>
                              {reg.attendance ? (
                                <StcStatusBadge status="CONFIRMED" />
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                  disabled={markMut.isPending}
                                  onClick={() =>
                                    markMut.mutate({
                                      activityId: selected.id,
                                      registrationId: reg.id,
                                    })
                                  }
                                >
                                  Mark Present
                                </Button>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'create' ? (
        <StcPanel
          title="Create activity"
          description="New activities start as draft — submit for HOD approval when ready."
          icon={Plus}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="da-title">Title</Label>
              <Input
                id="da-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                placeholder="Annual department seminar"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-dept">Department</Label>
              <select
                id="da-dept"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                required
              >
                <option value="">Select department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-type">Activity type</Label>
              <select
                id="da-type"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={form.activityType}
                onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}
                required
              >
                <option value="">Select type</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-event-date">Event date</Label>
              <DateInput
                id="da-event-date"
                value={form.eventDate}
                onChange={(v) => setForm((f) => ({ ...f, eventDate: v }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-venue">Venue</Label>
              <Input
                id="da-venue"
                value={form.venue ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="Seminar hall A"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-max">Max participants</Label>
              <Input
                id="da-max"
                type="number"
                min={1}
                value={form.maxParticipants ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxParticipants: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-reg-start">Registration opens</Label>
              <DateInput
                id="da-reg-start"
                value={form.registrationStartsAt ?? ''}
                onChange={(v) => setForm((f) => ({ ...f, registrationStartsAt: v }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="da-reg-end">Registration closes</Label>
              <DateInput
                id="da-reg-end"
                value={form.registrationEndsAt ?? ''}
                onChange={(v) => setForm((f) => ({ ...f, registrationEndsAt: v }))}
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="da-desc">Description</Label>
              <textarea
                id="da-desc"
                className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief overview for students and approvers"
              />
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create draft activity'
                )}
              </Button>
            </div>
          </form>
        </StcPanel>
      ) : null}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
