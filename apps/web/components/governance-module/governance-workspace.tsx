'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Loader2,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { ImportReviewPanel } from '@/components/governance-module/import-review-panel';
import { NaacEvidenceTagButton } from '@/components/naac-iqac-module/naac-evidence-tag-button';
import { GovernanceReportsCenter } from '@/components/governance-module/governance-reports-center';
import {
  createGovernanceActionItem,
  createGovernanceCommittee,
  createGovernanceEvent,
  createGovernanceMeeting,
  createGovernanceMember,
  createGovernanceNotice,
  createGovernanceTask,
  fetchGovernanceActionItems,
  fetchGovernanceAnalytics,
  fetchGovernanceAttendanceRegister,
  fetchGovernanceCommittees,
  fetchGovernanceDashboard,
  fetchGovernanceDocuments,
  fetchGovernanceEvents,
  fetchGovernanceMeetingCalendar,
  fetchGovernanceMeetings,
  fetchGovernanceMembers,
  fetchGovernanceNaacEvidence,
  fetchGovernanceNotices,
  fetchGovernancePerformanceSnapshots,
  fetchGovernanceSettings,
  fetchGovernanceTasks,
  publishGovernanceNotice,
  updateGovernanceActionItem,
  updateGovernanceSettings,
  updateGovernanceTask,
  uploadGovernanceDocument,
} from '@/services/governance';
import type {
  GovernanceActionItem,
  GovernanceCommittee,
  GovernanceDashboard,
  GovernanceMeeting,
  GovernanceSettings,
} from '@/types/governance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export type GovernancePage =
  | 'dashboard'
  | 'committees'
  | 'members'
  | 'meetings'
  | 'calendar'
  | 'atr'
  | 'attendance'
  | 'tasks'
  | 'notices'
  | 'documents'
  | 'events'
  | 'reports'
  | 'naac'
  | 'analytics'
  | 'settings';

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.includes('COMPLET') || s === 'PUBLISHED' || s === 'ACTIVE' || s === 'PRESENT')
    return 'bg-emerald-100 text-emerald-800';
  if (s.includes('PEND') || s === 'SCHEDULED' || s === 'DRAFT')
    return 'bg-amber-100 text-amber-800';
  if (s.includes('OVERDUE') || s === 'ABSENT' || s === 'INACTIVE')
    return 'bg-rose-100 text-rose-800';
  return 'bg-muted text-muted-foreground';
}

function StatusMessage({
  message,
  error,
  onClear,
}: {
  message: string;
  error: string;
  onClear: () => void;
}) {
  if (!message && !error) return null;
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-4 py-3 text-sm',
        error
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-primary/20 bg-primary/5',
      )}
    >
      <span>{error || message}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Dismiss
      </Button>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2">
                  {row[col] == null || row[col] === '' ? '—' : String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No records found.</p>
      ) : null}
    </div>
  );
}

function GovernanceHero({
  dashboard,
  loading,
}: {
  dashboard?: GovernanceDashboard;
  loading: boolean;
}) {
  const kpis = dashboard?.kpis;
  const cards = [
    { label: 'Active committees', value: kpis?.activeCommittees, icon: Shield },
    { label: 'Members', value: kpis?.totalMembers, icon: Users },
    { label: 'Meetings this month', value: kpis?.meetingsThisMonth, icon: CalendarDays },
    { label: 'Pending ATR', value: kpis?.pendingAtr, icon: ClipboardList },
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-5 shadow-sm">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Committee & Governance Management
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">CGMS — Governance Console</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Committees, meetings, attendance, ATR, notices, documents, NAAC evidence, and performance
        analytics.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
          >
            <Icon className="mb-2 h-5 w-5 text-primary" />
            <p className="text-xl font-semibold">{loading ? '…' : (value ?? '—')}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPanels({ dashboard }: { dashboard?: GovernanceDashboard }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today&apos;s meetings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(dashboard?.todaysMeetings ?? []).map((m) => (
            <div key={m.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">
                {m.committeeName} · {new Date(m.meetingDate).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
          {!dashboard?.todaysMeetings?.length ? (
            <p className="text-sm text-muted-foreground">No meetings scheduled for today.</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pending ATR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(dashboard?.pendingAtrItems ?? []).slice(0, 6).map((a) => (
            <div key={a.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{a.actionItem}</p>
              <p className="text-xs text-muted-foreground">{a.committeeName}</p>
            </div>
          ))}
          {!dashboard?.pendingAtrItems?.length ? (
            <p className="text-sm text-muted-foreground">No pending action items.</p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance ranking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(dashboard?.performanceRanking ?? []).slice(0, 5).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>{p.committeeName ?? p.committeeId}</span>
              <Badge variant="outline">{Math.round(p.scoreTotal)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(dashboard?.upcomingEvents ?? []).slice(0, 5).map((e) => (
            <div key={e.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground">
                {e.committeeName} · {new Date(e.startDate).toLocaleDateString('en-IN')}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MeetingCalendar({
  events,
}: {
  events:
    | GovernanceMeeting[]
    | Array<{ id: string; title: string; meetingDate: string; committeeName?: string }>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = new Date(e.meetingDate).toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="space-y-4">
      {grouped.map(([date, items]) => (
        <div key={date} className="rounded-xl border p-4">
          <p className="text-sm font-semibold">
            {new Date(date).toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="mt-3 space-y-2">
            {items.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.committeeName ?? 'Committee'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!grouped.length ? (
        <p className="text-sm text-muted-foreground">No calendar events in range.</p>
      ) : null}
    </div>
  );
}

export function GovernanceWorkspace({ page = 'dashboard' }: { page?: GovernancePage }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [committeeForm, setCommitteeForm] = useState({
    name: '',
    shortCode: '',
    category: 'ACADEMIC',
    committeeType: 'STANDING',
    description: '',
  });
  const [memberForm, setMemberForm] = useState({
    committeeId: '',
    displayName: '',
    role: 'MEMBER',
    designation: '',
    email: '',
    mobile: '',
  });
  const [meetingForm, setMeetingForm] = useState({
    committeeId: '',
    title: '',
    meetingDate: '',
    meetingTime: '',
    venue: '',
    meetingMode: 'PHYSICAL',
  });
  const [atrForm, setAtrForm] = useState({
    committeeId: '',
    actionItem: '',
    assignedName: '',
    targetDate: '',
  });
  const [taskForm, setTaskForm] = useState({
    committeeId: '',
    title: '',
    assignedName: '',
    dueDate: '',
  });
  const [noticeForm, setNoticeForm] = useState({
    committeeId: '',
    title: '',
    body: '',
    audience: 'COMMITTEE',
  });
  const [eventForm, setEventForm] = useState({
    committeeId: '',
    title: '',
    eventType: 'SEMINAR',
    startDate: '',
    venue: '',
  });
  const [settingsForm, setSettingsForm] = useState<Partial<GovernanceSettings>>({});

  const dashboardQ = useQuery({
    queryKey: ['governance', 'dashboard'],
    queryFn: fetchGovernanceDashboard,
    enabled,
  });
  const committeesQ = useQuery({
    queryKey: ['governance', 'committees'],
    queryFn: () => fetchGovernanceCommittees({ limit: 100 }),
    enabled:
      enabled &&
      [
        'committees',
        'members',
        'meetings',
        'atr',
        'tasks',
        'notices',
        'events',
        'settings',
      ].includes(page),
  });
  const membersQ = useQuery({
    queryKey: ['governance', 'members'],
    queryFn: () => fetchGovernanceMembers({ limit: 100 }),
    enabled: enabled && page === 'members',
  });
  const meetingsQ = useQuery({
    queryKey: ['governance', 'meetings'],
    queryFn: () => fetchGovernanceMeetings({ limit: 100 }),
    enabled: enabled && (page === 'meetings' || page === 'calendar'),
  });
  const calendarQ = useQuery({
    queryKey: ['governance', 'calendar'],
    queryFn: () => fetchGovernanceMeetingCalendar({ limit: 100 }),
    enabled: enabled && page === 'calendar',
  });
  const atrQ = useQuery({
    queryKey: ['governance', 'atr'],
    queryFn: () => fetchGovernanceActionItems({ limit: 100 }),
    enabled: enabled && page === 'atr',
  });
  const attendanceQ = useQuery({
    queryKey: ['governance', 'attendance'],
    queryFn: () => fetchGovernanceAttendanceRegister({ limit: 100 }),
    enabled: enabled && page === 'attendance',
  });
  const tasksQ = useQuery({
    queryKey: ['governance', 'tasks'],
    queryFn: () => fetchGovernanceTasks({ limit: 100 }),
    enabled: enabled && page === 'tasks',
  });
  const noticesQ = useQuery({
    queryKey: ['governance', 'notices'],
    queryFn: () => fetchGovernanceNotices({ limit: 100 }),
    enabled: enabled && page === 'notices',
  });
  const documentsQ = useQuery({
    queryKey: ['governance', 'documents'],
    queryFn: () => fetchGovernanceDocuments({ limit: 100 }),
    enabled: enabled && page === 'documents',
  });
  const eventsQ = useQuery({
    queryKey: ['governance', 'events'],
    queryFn: () => fetchGovernanceEvents({ limit: 100 }),
    enabled: enabled && page === 'events',
  });
  const naacQ = useQuery({
    queryKey: ['governance', 'naac'],
    queryFn: () => fetchGovernanceNaacEvidence({ limit: 100 }),
    enabled: enabled && page === 'naac',
  });
  const analyticsQ = useQuery({
    queryKey: ['governance', 'analytics'],
    queryFn: () => fetchGovernanceAnalytics(),
    enabled: enabled && page === 'analytics',
  });
  const rankingsQ = useQuery({
    queryKey: ['governance', 'rankings'],
    queryFn: () => fetchGovernancePerformanceSnapshots(),
    enabled: enabled && page === 'analytics',
  });
  const settingsQ = useQuery({
    queryKey: ['governance', 'settings'],
    queryFn: fetchGovernanceSettings,
    enabled: enabled && page === 'settings',
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['governance'] });

  const createCommitteeMut = useMutation({
    mutationFn: () => createGovernanceCommittee(committeeForm),
    onSuccess: () => {
      setMessage('Committee created.');
      setCommitteeForm({
        name: '',
        shortCode: '',
        category: 'ACADEMIC',
        committeeType: 'STANDING',
        description: '',
      });
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to create committee.')),
  });

  const createMemberMut = useMutation({
    mutationFn: () => createGovernanceMember(memberForm.committeeId, memberForm),
    onSuccess: () => {
      setMessage('Member added.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to add member.')),
  });

  const createMeetingMut = useMutation({
    mutationFn: () => createGovernanceMeeting(meetingForm),
    onSuccess: () => {
      setMessage('Meeting scheduled.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to schedule meeting.')),
  });

  const createAtrMut = useMutation({
    mutationFn: () => createGovernanceActionItem(atrForm),
    onSuccess: () => {
      setMessage('ATR item created.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to create ATR.')),
  });

  const createTaskMut = useMutation({
    mutationFn: () => createGovernanceTask(taskForm),
    onSuccess: () => {
      setMessage('Task created.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to create task.')),
  });

  const createNoticeMut = useMutation({
    mutationFn: () => createGovernanceNotice(noticeForm),
    onSuccess: () => {
      setMessage('Notice saved as draft.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to create notice.')),
  });

  const createEventMut = useMutation({
    mutationFn: () => createGovernanceEvent(eventForm),
    onSuccess: () => {
      setMessage('Event created.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to create event.')),
  });

  const settingsMut = useMutation({
    mutationFn: () => updateGovernanceSettings(settingsForm),
    onSuccess: () => {
      setMessage('Settings saved.');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Unable to save settings.')),
  });

  const committees = committeesQ.data?.items ?? [];

  if (page === 'reports') {
    return <GovernanceReportsCenter />;
  }

  return (
    <div className="space-y-5">
      {(page === 'dashboard' || page === 'committees') && (
        <GovernanceHero dashboard={dashboardQ.data} loading={dashboardQ.isLoading} />
      )}
      <StatusMessage
        message={message}
        error={error}
        onClear={() => {
          setMessage('');
          setError('');
        }}
      />

      {page === 'dashboard' && <DashboardPanels dashboard={dashboardQ.data} />}

      {page === 'committees' && (
        <>
          <ImportReviewPanel onMessage={setMessage} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create committee</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={committeeForm.name}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Short code</Label>
                <Input
                  value={committeeForm.shortCode}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, shortCode: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  value={committeeForm.category}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, category: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input
                  value={committeeForm.committeeType}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, committeeType: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={committeeForm.description}
                  onChange={(e) =>
                    setCommitteeForm({ ...committeeForm, description: e.target.value })
                  }
                />
              </div>
              <Button
                onClick={() => createCommitteeMut.mutate()}
                disabled={createCommitteeMut.isPending}
              >
                Save committee
              </Button>
            </CardContent>
          </Card>
          <CommitteeTable committees={committees} loading={committeesQ.isLoading} />
        </>
      )}

      {page === 'members' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add member</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Committee</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={memberForm.committeeId}
                  onChange={(e) => setMemberForm({ ...memberForm, committeeId: e.target.value })}
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={memberForm.displayName}
                  onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Input
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                />
              </div>
              <div>
                <Label>Designation</Label>
                <Input
                  value={memberForm.designation}
                  onChange={(e) => setMemberForm({ ...memberForm, designation: e.target.value })}
                />
              </div>
              <Button
                onClick={() => createMemberMut.mutate()}
                disabled={createMemberMut.isPending || !memberForm.committeeId}
              >
                Add member
              </Button>
            </CardContent>
          </Card>
          <DataTable
            columns={['displayName', 'committeeName', 'role', 'designation', 'status']}
            rows={(membersQ.data?.items ?? []).map((m) => ({ ...m }))}
          />
        </>
      )}

      {page === 'meetings' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule meeting</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Committee</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={meetingForm.committeeId}
                  onChange={(e) => setMeetingForm({ ...meetingForm, committeeId: e.target.value })}
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={meetingForm.meetingDate}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  value={meetingForm.meetingTime}
                  onChange={(e) => setMeetingForm({ ...meetingForm, meetingTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Venue</Label>
                <Input
                  value={meetingForm.venue}
                  onChange={(e) => setMeetingForm({ ...meetingForm, venue: e.target.value })}
                />
              </div>
              <Button
                onClick={() => createMeetingMut.mutate()}
                disabled={createMeetingMut.isPending}
              >
                Schedule
              </Button>
            </CardContent>
          </Card>
          <DataTable
            columns={['title', 'committeeName', 'meetingDate', 'venue', 'status']}
            rows={(meetingsQ.data?.items ?? []).map((m) => ({
              ...m,
              meetingDate: new Date(m.meetingDate).toLocaleString('en-IN'),
            }))}
          />
        </>
      )}

      {page === 'calendar' && (
        <MeetingCalendar events={calendarQ.data ?? meetingsQ.data?.items ?? []} />
      )}

      {page === 'atr' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New action item</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Committee</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={atrForm.committeeId}
                  onChange={(e) => setAtrForm({ ...atrForm, committeeId: e.target.value })}
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Action</Label>
                <Input
                  value={atrForm.actionItem}
                  onChange={(e) => setAtrForm({ ...atrForm, actionItem: e.target.value })}
                />
              </div>
              <div>
                <Label>Assignee</Label>
                <Input
                  value={atrForm.assignedName}
                  onChange={(e) => setAtrForm({ ...atrForm, assignedName: e.target.value })}
                />
              </div>
              <div>
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={atrForm.targetDate}
                  onChange={(e) => setAtrForm({ ...atrForm, targetDate: e.target.value })}
                />
              </div>
              <Button onClick={() => createAtrMut.mutate()} disabled={createAtrMut.isPending}>
                Create ATR
              </Button>
            </CardContent>
          </Card>
          <AtrTable
            items={atrQ.data?.items ?? []}
            onComplete={(id) =>
              updateGovernanceActionItem(id, { status: 'COMPLETED' })
                .then(() => {
                  setMessage('ATR marked complete.');
                  invalidate();
                })
                .catch((e) => setError(apiErrorMessage(e, 'Unable to update ATR.')))
            }
          />
        </>
      )}

      {page === 'attendance' && (
        <DataTable
          columns={['displayName', 'meetingTitle', 'meetingDate', 'status', 'method']}
          rows={(attendanceQ.data?.items ?? []).map((a) => ({
            displayName: a.displayName,
            meetingTitle: a.meetingTitle ?? '—',
            meetingDate: a.meetingDate ? new Date(a.meetingDate).toLocaleDateString('en-IN') : '—',
            status: a.status,
            method: a.method,
          }))}
        />
      )}

      {page === 'tasks' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign task</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Committee</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={taskForm.committeeId}
                  onChange={(e) => setTaskForm({ ...taskForm, committeeId: e.target.value })}
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Assignee</Label>
                <Input
                  value={taskForm.assignedName}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedName: e.target.value })}
                />
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                />
              </div>
              <Button onClick={() => createTaskMut.mutate()} disabled={createTaskMut.isPending}>
                Create task
              </Button>
            </CardContent>
          </Card>
          <TaskTable
            tasks={tasksQ.data?.items ?? []}
            onComplete={(id) =>
              updateGovernanceTask(id, { status: 'COMPLETED' })
                .then(() => {
                  setMessage('Task completed.');
                  invalidate();
                })
                .catch((e) => setError(apiErrorMessage(e, 'Unable to update task.')))
            }
          />
        </>
      )}

      {page === 'notices' && (
        <>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Committee notices only.</strong> For institution-wide official letters with DBC
            letterhead, VP→Principal approval, and auto reference numbers, use{' '}
            <a
              href="/admin/administration/official-documents"
              className="font-medium underline underline-offset-2"
            >
              Administration → Official Documents
            </a>
            .
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draft notice</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Committee (optional)</Label>
                  <select
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={noticeForm.committeeId}
                    onChange={(e) => setNoticeForm({ ...noticeForm, committeeId: e.target.value })}
                  >
                    <option value="">Institution-wide</option>
                    {committees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={noticeForm.title}
                    onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Body</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={noticeForm.body}
                  onChange={(e) => setNoticeForm({ ...noticeForm, body: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => createNoticeMut.mutate()}
                  disabled={createNoticeMut.isPending}
                >
                  Save draft
                </Button>
              </div>
            </CardContent>
          </Card>
          <NoticeTable
            notices={noticesQ.data?.items ?? []}
            onPublish={(id) =>
              publishGovernanceNotice(id)
                .then(() => {
                  setMessage('Notice published.');
                  invalidate();
                })
                .catch((e) => setError(apiErrorMessage(e, 'Unable to publish notice.')))
            }
          />
        </>
      )}

      {page === 'documents' && (
        <DocumentsPanel
          onMessage={setMessage}
          onError={setError}
          documents={documentsQ.data?.items ?? []}
          committees={committees}
        />
      )}

      {page === 'events' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record activity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Committee</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={eventForm.committeeId}
                  onChange={(e) => setEventForm({ ...eventForm, committeeId: e.target.value })}
                >
                  <option value="">Select committee</option>
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={eventForm.startDate}
                  onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Venue</Label>
                <Input
                  value={eventForm.venue}
                  onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                />
              </div>
              <Button onClick={() => createEventMut.mutate()} disabled={createEventMut.isPending}>
                Save event
              </Button>
            </CardContent>
          </Card>
          <DataTable
            columns={['title', 'committeeName', 'eventType', 'startDate', 'status']}
            rows={(eventsQ.data?.items ?? []).map((e) => ({
              ...e,
              startDate: new Date(e.startDate).toLocaleDateString('en-IN'),
            }))}
          />
        </>
      )}

      {page === 'naac' && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30">
          NAAC evidence tagging has moved to the full{' '}
          <a href="/admin/naac" className="font-medium underline">
            NAAC & IQAC (NIMS)
          </a>{' '}
          module. This view shows legacy governance tags only.
        </div>
      )}
      {page === 'naac' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NAAC evidence library</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={['entityType', 'entityId', 'criterion', 'evidenceNotes']}
              rows={(naacQ.data?.items ?? []).map((t) => ({ ...t }))}
            />
          </CardContent>
        </Card>
      )}

      {page === 'analytics' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Performance trend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(analyticsQ.data?.performanceTrend ?? []).map((p) => (
                <div
                  key={p.month}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{p.month}</span>
                  <Badge variant="outline">{Math.round(p.averageScore)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Committee rankings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(rankingsQ.data ?? analyticsQ.data?.topCommittees ?? []).slice(0, 10).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{p.committeeName ?? p.committeeId}</span>
                  <Badge className={cn('text-xs', statusTone('ACTIVE'))}>
                    {Math.round(p.scoreTotal)}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {page === 'settings' && (
        <SettingsPanel
          settings={settingsQ.data}
          form={settingsForm}
          setForm={setSettingsForm}
          onSave={() => settingsMut.mutate()}
          saving={settingsMut.isPending}
        />
      )}
    </div>
  );
}

function CommitteeTable({
  committees,
  loading,
}: {
  committees: GovernanceCommittee[];
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading committees…
      </div>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Committee master</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Members</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {committees.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-2 py-2 font-medium">{c.name}</td>
                  <td className="px-2 py-2">{c.shortCode}</td>
                  <td className="px-2 py-2">{c.category}</td>
                  <td className="px-2 py-2">{c.memberCount ?? '—'}</td>
                  <td className="px-2 py-2">
                    <Badge className={cn('text-xs', statusTone(c.status))}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!committees.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No committees yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AtrTable({
  items,
  onComplete,
}: {
  items: GovernanceActionItem[];
  onComplete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Committee</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="px-3 py-2">{a.actionItem}</td>
              <td className="px-3 py-2">{a.committeeName ?? '—'}</td>
              <td className="px-3 py-2">{a.assignedName ?? '—'}</td>
              <td className="px-3 py-2">
                {a.targetDate ? new Date(a.targetDate).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="px-3 py-2">
                <Badge className={cn('text-xs', statusTone(a.status))}>{a.status}</Badge>
              </td>
              <td className="px-3 py-2">
                {a.status !== 'COMPLETED' ? (
                  <Button size="sm" variant="outline" onClick={() => onComplete(a.id)}>
                    Complete
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTable({
  tasks,
  onComplete,
}: {
  tasks: Array<{
    id: string;
    title: string;
    committeeName?: string;
    assignedName?: string | null;
    dueDate?: string | null;
    status: string;
  }>;
  onComplete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2">Task</th>
            <th className="px-3 py-2">Committee</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="px-3 py-2">{t.title}</td>
              <td className="px-3 py-2">{t.committeeName ?? '—'}</td>
              <td className="px-3 py-2">{t.assignedName ?? '—'}</td>
              <td className="px-3 py-2">
                {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-IN') : '—'}
              </td>
              <td className="px-3 py-2">
                <Badge className={cn('text-xs', statusTone(t.status))}>{t.status}</Badge>
              </td>
              <td className="px-3 py-2">
                {t.status !== 'COMPLETED' ? (
                  <Button size="sm" variant="outline" onClick={() => onComplete(t.id)}>
                    Complete
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoticeTable({
  notices,
  onPublish,
}: {
  notices: Array<{
    id: string;
    title: string;
    noticeNo?: string | null;
    status: string;
    audience: string;
  }>;
  onPublish: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Number</th>
            <th className="px-3 py-2">Audience</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {notices.map((n) => (
            <tr key={n.id} className="border-b">
              <td className="px-3 py-2">{n.title}</td>
              <td className="px-3 py-2">{n.noticeNo ?? '—'}</td>
              <td className="px-3 py-2">{n.audience}</td>
              <td className="px-3 py-2">
                <Badge className={cn('text-xs', statusTone(n.status))}>{n.status}</Badge>
              </td>
              <td className="px-3 py-2">
                {n.status !== 'PUBLISHED' ? (
                  <Button size="sm" onClick={() => onPublish(n.id)}>
                    Publish
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentsPanel({
  documents,
  committees,
  onMessage,
  onError,
}: {
  documents: Array<{
    id: string;
    title: string;
    fileName: string;
    category: string;
    folderPath: string;
    committeeName?: string;
  }>;
  committees: GovernanceCommittee[];
  onMessage: (m: string) => void;
  onError: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [committeeId, setCommitteeId] = useState('');
  const [category, setCategory] = useState('MINUTES');
  const [title, setTitle] = useState('');

  const uploadMut = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      form.append('category', category);
      form.append('folderPath', `${new Date().getFullYear()}/${category}`);
      if (committeeId) form.append('committeeId', committeeId);
      return uploadGovernanceDocument(form);
    },
    onSuccess: () => {
      onMessage('Document uploaded.');
      void qc.invalidateQueries({ queryKey: ['governance', 'documents'] });
    },
    onError: (e) => onError(apiErrorMessage(e, 'Upload failed.')),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload document</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Committee</Label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
            >
              <option value="">General</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex items-end">
            <input
              type="file"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMut.mutate(f);
                e.target.value = '';
              }}
            />
          </div>
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">title</th>
              <th className="px-3 py-2 text-left font-medium">fileName</th>
              <th className="px-3 py-2 text-left font-medium">category</th>
              <th className="px-3 py-2 text-left font-medium">folderPath</th>
              <th className="px-3 py-2 text-left font-medium">committeeName</th>
              <th className="px-3 py-2 text-left font-medium">NAAC</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                  No records found.
                </td>
              </tr>
            ) : (
              documents.map((d) => (
                <tr key={d.id} className="border-t align-top">
                  <td className="px-3 py-2">{d.title}</td>
                  <td className="px-3 py-2">{d.fileName}</td>
                  <td className="px-3 py-2">{d.category}</td>
                  <td className="px-3 py-2">{d.folderPath}</td>
                  <td className="px-3 py-2">{d.committeeName ?? '—'}</td>
                  <td className="px-3 py-2">
                    <NaacEvidenceTagButton
                      sourceType="governance_document"
                      sourceId={d.id}
                      label="Tag"
                      defaultCriterion={6}
                      fileName={d.fileName}
                      defaultActivityTitle={d.title}
                      defaultEvidenceNotes={`${d.category} — ${d.title}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsPanel({
  settings,
  form,
  setForm,
  onSave,
  saving,
}: {
  settings?: GovernanceSettings;
  form: Partial<GovernanceSettings>;
  setForm: (v: Partial<GovernanceSettings>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const current = { ...settings, ...form };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Module settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Default academic year</Label>
          <Input
            value={current.defaultAcademicYear ?? ''}
            onChange={(e) => setForm({ ...form, defaultAcademicYear: e.target.value })}
          />
        </div>
        <div>
          <Label>Notice prefix</Label>
          <Input
            value={current.noticePrefix ?? 'DBC/CIRC'}
            onChange={(e) => setForm({ ...form, noticePrefix: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>Email notifications</Label>
          <Switch
            checked={current.notifyEmail ?? true}
            onCheckedChange={(v) => setForm({ ...form, notifyEmail: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>In-app notifications</Label>
          <Switch
            checked={current.notifyInApp ?? true}
            onCheckedChange={(v) => setForm({ ...form, notifyInApp: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>Push notifications</Label>
          <Switch
            checked={current.notifyPush ?? true}
            onCheckedChange={(v) => setForm({ ...form, notifyPush: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label>QR attendance</Label>
          <Switch
            checked={current.qrAttendanceEnabled ?? true}
            onCheckedChange={(v) => setForm({ ...form, qrAttendanceEnabled: v })}
          />
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save settings
        </Button>
      </CardContent>
    </Card>
  );
}
