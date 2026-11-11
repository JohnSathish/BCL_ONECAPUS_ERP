'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Send,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  BIRTHDAY_CHANNELS,
  exportBirthdayHistory,
  fetchBirthdayCalendar,
  fetchBirthdayHistory,
  fetchBirthdayOverview,
  fetchBirthdayPeople,
  fetchBirthdaySettings,
  fetchBirthdayTemplates,
  previewBirthdayWish,
  saveBirthdaySettings,
  saveBirthdayTemplate,
  sendBirthdayWishes,
  type BirthdayAudience,
  type BirthdayPerson,
  type BirthdaySettings,
  type BirthdayStatus,
  type BirthdayWindow,
} from '@/services/birthday-wishes';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const TABS = [
  { id: 'students', label: 'Student Birthdays' },
  { id: 'staff', label: 'Staff Birthdays' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'history', label: 'History' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Automation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const STATUS_TONE: Record<BirthdayStatus, string> = {
  SENT: 'bg-emerald-50 text-emerald-700',
  QUEUED: 'bg-sky-50 text-sky-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FAILED: 'bg-rose-50 text-rose-700',
  UPCOMING: 'bg-violet-50 text-violet-700',
  MISSED: 'bg-slate-100 text-slate-600',
};

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDob(value: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function BirthdayWishesPage() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('students');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [window, setWindow] = useState<BirthdayWindow>('today');
  const [staffType, setStaffType] = useState('ALL');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [month, setMonth] = useState(monthKey());
  const [day, setDay] = useState<number | undefined>();
  const [notice, setNotice] = useState('');
  const [composer, setComposer] = useState<BirthdayPerson[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('Happy Birthday, {name}!');
  const [body, setBody] = useState(
    'Happy Birthday, {name}!\n\nWishing you a wonderful year filled with happiness, good health, success and countless blessings.\n\nWith best wishes,\n{college_name}',
  );
  const [channels, setChannels] = useState<string[]>(['PUSH', 'IN_APP']);
  const [retry, setRetry] = useState(false);
  const [focus, setFocus] = useState<BirthdayAudience>('STUDENT');

  const audience: BirthdayAudience =
    tab === 'staff' ? 'STAFF' : tab === 'students' ? 'STUDENT' : focus;
  const listWindow: BirthdayWindow =
    tab === 'upcoming' ? window : tab === 'students' || tab === 'staff' ? 'today' : window;

  const overview = useQuery({
    queryKey: ['birthday-overview'],
    queryFn: fetchBirthdayOverview,
    enabled,
  });
  const people = useQuery({
    queryKey: [
      'birthday-people',
      audience,
      listWindow,
      month,
      day,
      staffType,
      search,
      status,
      page,
      tab,
    ],
    queryFn: () =>
      fetchBirthdayPeople({
        audience: tab === 'upcoming' ? audience : audience,
        window: tab === 'upcoming' ? window : 'today',
        month: tab === 'upcoming' && window === 'month' ? month : undefined,
        day: tab === 'upcoming' && window === 'month' ? day : undefined,
        staffType: audience === 'STAFF' ? staffType : undefined,
        search,
        status: status || undefined,
        page,
        pageSize: 10,
      }),
    enabled: enabled && (tab === 'students' || tab === 'staff' || tab === 'upcoming'),
  });
  const calendar = useQuery({
    queryKey: ['birthday-calendar', month],
    queryFn: () => fetchBirthdayCalendar(month),
    enabled: enabled && tab === 'upcoming',
  });
  const history = useQuery({
    queryKey: ['birthday-history', search, page],
    queryFn: () => fetchBirthdayHistory({ search, page, pageSize: 15 }),
    enabled: enabled && tab === 'history',
  });
  const templates = useQuery({
    queryKey: ['birthday-templates'],
    queryFn: fetchBirthdayTemplates,
    enabled: enabled && (tab === 'templates' || tab === 'settings' || composer !== null),
  });
  const settings = useQuery({
    queryKey: ['birthday-settings'],
    queryFn: fetchBirthdaySettings,
    enabled: enabled && tab === 'settings',
  });

  const preview = useQuery({
    queryKey: ['birthday-preview', composer?.[0]?.id, templateId, subject, body, audience],
    queryFn: () =>
      previewBirthdayWish({
        audience,
        id: composer?.[0]?.id,
        templateId: templateId || undefined,
        subject,
        body,
      }),
    enabled: enabled && Boolean(composer?.length),
  });

  const send = useMutation({
    mutationFn: sendBirthdayWishes,
    onSuccess: async (result) => {
      setNotice(
        `Queued ${result.queued}, skipped ${result.skipped}, failed ${result.failed}. Push wishes stay in the notification menu.`,
      );
      setComposer(null);
      setConfirming(false);
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ['birthday-overview'] });
      await queryClient.invalidateQueries({ queryKey: ['birthday-people'] });
      await queryClient.invalidateQueries({ queryKey: ['birthday-history'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'The birthday wish could not be sent.')),
  });

  const rows = people.data?.rows ?? [];
  const pageIds = rows.map((row) => row.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  function toggleAll() {
    setSelected((current) =>
      allSelected
        ? current.filter((id) => !pageIds.includes(id))
        : [...new Set([...current, ...pageIds])],
    );
  }

  function openComposer(peopleRows: BirthdayPerson[], asRetry = false) {
    setRetry(asRetry);
    setConfirming(false);
    setComposer(peopleRows);
  }

  function submitWish() {
    if (!composer?.length) return;
    if (composer.length > 1 && !confirming) {
      setConfirming(true);
      return;
    }
    send.mutate({
      audience,
      ids: composer.map((person) => person.id),
      channels,
      templateId: templateId || undefined,
      subject,
      body,
      retry,
    });
  }

  const summary = overview.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Birthday Wishes</h1>
          <p className="text-sm text-slate-500">
            Student and staff birthdays, sent in India Standard Time. Push wishes stay in the app
            notification menu.
          </p>
        </div>
        <Button
          onClick={() => {
            const chosen = rows.filter((row) => selected.includes(row.id));
            if (!chosen.length) {
              setNotice('Select one or more people first.');
              return;
            }
            openComposer(chosen);
          }}
          disabled={tab === 'history' || tab === 'templates' || tab === 'settings'}
        >
          <Send className="mr-2 h-4 w-4" />
          Send wishes
        </Button>
      </div>

      {notice ? (
        <p className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Stat
          icon={GraduationCap}
          label="Today's student birthdays"
          value={summary?.todayStudents}
          tone="bg-sky-50 text-sky-700"
        />
        <Stat
          icon={Users}
          label="Today's staff birthdays"
          value={summary?.todayStaff}
          tone="bg-indigo-50 text-indigo-700"
        />
        <Stat
          icon={CalendarDays}
          label="Upcoming birthdays"
          value={summary?.upcoming}
          hint="Next 7 days"
          tone="bg-violet-50 text-violet-700"
        />
        <Stat
          icon={Cake}
          label="Wishes sent today"
          value={summary?.sentToday}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat
          icon={Clock3}
          label="Pending birthday wishes"
          value={summary?.pending}
          tone="bg-amber-50 text-amber-700"
        />
        <Stat
          icon={AlertTriangle}
          label="Failed notifications"
          value={summary?.failed}
          tone="bg-rose-50 text-rose-700"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setPage(1);
              setSelected([]);
              setSearch('');
              if (item.id === 'students') setFocus('STUDENT');
              if (item.id === 'staff') setFocus('STAFF');
              if (item.id === 'upcoming') setWindow('next7');
            }}
            className={cn(
              'shrink-0 rounded-xl px-3 py-2 text-sm font-medium',
              tab === item.id
                ? 'bg-primary text-primary-foreground'
                : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'students' || tab === 'staff' || tab === 'upcoming' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, roll number, department or mobile"
              className="max-w-sm"
            />
            {audience === 'STAFF' && (tab === 'staff' || tab === 'upcoming') ? (
              <select
                value={staffType}
                onChange={(event) => setStaffType(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="ALL">Teaching and non-teaching</option>
                <option value="TEACHING">Teaching staff</option>
                <option value="NON_TEACHING">Non-teaching staff</option>
              </select>
            ) : null}
            {tab === 'upcoming' ? (
              <>
                <FilterChip
                  active={focus === 'STUDENT'}
                  onClick={() => {
                    setFocus('STUDENT');
                    setPage(1);
                    setSelected([]);
                  }}
                >
                  Students
                </FilterChip>
                <FilterChip
                  active={focus === 'STAFF'}
                  onClick={() => {
                    setFocus('STAFF');
                    setPage(1);
                    setSelected([]);
                  }}
                >
                  Staff
                </FilterChip>
                {(['tomorrow', 'next7', 'next30', 'month'] as BirthdayWindow[]).map((item) => (
                  <FilterChip
                    key={item}
                    active={window === item}
                    onClick={() => {
                      setWindow(item);
                      setDay(undefined);
                      setPage(1);
                    }}
                  >
                    {item === 'tomorrow'
                      ? 'Tomorrow'
                      : item === 'next7'
                        ? 'Next 7 days'
                        : item === 'next30'
                          ? 'Next 30 days'
                          : 'This month'}
                  </FilterChip>
                ))}
              </>
            ) : null}
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="SENT">Sent</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED">Failed</option>
              <option value="UPCOMING">Upcoming</option>
            </select>
          </div>

          {tab === 'upcoming' && window === 'month' && calendar.data ? (
            <MonthGrid
              startWeekday={calendar.data.startWeekday}
              today={calendar.data.today}
              days={calendar.data.days}
              selected={day}
              onSelect={(value) => {
                setDay(value);
                setPage(1);
              }}
              onShift={(delta) => {
                const [year, mon] = month.split('-').map(Number);
                const next = new Date(year, mon - 1 + delta, 1);
                setMonth(monthKey(next));
                setDay(undefined);
              }}
              label={calendar.data.month}
            />
          ) : null}

          <PeopleTable
            rows={rows}
            loading={people.isLoading}
            audience={audience}
            selected={selected}
            allSelected={allSelected}
            onToggleAll={toggleAll}
            onToggle={(id) =>
              setSelected((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
              )
            }
            onSend={(person) => openComposer([person], person.status === 'FAILED')}
          />
          <Pager
            page={page}
            total={people.data?.total ?? 0}
            pageSize={people.data?.pageSize ?? 10}
            onPage={setPage}
          />
        </section>
      ) : null}

      {tab === 'history' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search recipient or message"
              className="max-w-sm"
            />
            <Button variant="outline" size="sm" onClick={() => void exportBirthdayHistory('xlsx')}>
              Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportBirthdayHistory('pdf')}>
              Export PDF
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {[
                    'Recipient',
                    'Category',
                    'Birthday',
                    'Message',
                    'Channel',
                    'Sent',
                    'Status',
                    'Sent by',
                    'Failure',
                  ].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(history.data?.rows ?? []).map((row, index) => (
                  <tr
                    key={`${row.recipientName}-${row.sentAt}-${index}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 font-medium">{row.recipientName ?? '—'}</td>
                    <td className="px-3 py-2">{row.category}</td>
                    <td className="px-3 py-2">{row.birthdayDate || '—'}</td>
                    <td className="max-w-[240px] truncate px-3 py-2" title={row.message ?? ''}>
                      {row.message ?? '—'}
                    </td>
                    <td className="px-3 py-2">{row.channel ?? '—'}</td>
                    <td className="px-3 py-2">{formatWhen(row.sentAt)}</td>
                    <td className="px-3 py-2">{row.status ?? '—'}</td>
                    <td className="px-3 py-2">{row.sentBy ?? '—'}</td>
                    <td className="px-3 py-2 text-rose-700">{row.failureReason ?? '—'}</td>
                  </tr>
                ))}
                {!history.data?.rows.length && !history.isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      No birthday wishes have been recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={history.data?.total ?? 0} pageSize={15} onPage={setPage} />
        </section>
      ) : null}

      {tab === 'templates' ? (
        <TemplatesPanel
          templates={templates.data ?? []}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['birthday-templates'] });
            setNotice('Birthday template saved.');
          }}
        />
      ) : null}

      {tab === 'settings' && settings.data ? (
        <SettingsPanel
          initial={settings.data}
          templates={templates.data ?? []}
          onSaved={(next) => {
            queryClient.setQueryData(['birthday-settings'], next);
            setNotice('Birthday automation settings saved.');
          }}
        />
      ) : null}

      <Dialog open={Boolean(composer)} onOpenChange={(open) => !open && setComposer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {confirming ? 'Confirm birthday wishes' : 'Send a birthday wish'}
            </DialogTitle>
            <DialogDescription>
              {composer?.length
                ? `${composer.length} recipient${composer.length === 1 ? '' : 's'} selected.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {confirming ? (
            <p className="text-sm text-slate-600">
              Send this wish now to {composer?.length} people on the selected channels? People who
              already received this year&apos;s wish are skipped.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-500">Template</span>
                <select
                  value={templateId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setTemplateId(id);
                    const template = templates.data?.find((item) => item.id === id);
                    if (template) {
                      setSubject(template.subject ?? '');
                      setBody(template.bodyText ?? '');
                    }
                  }}
                  className="h-10 w-full rounded-md border border-slate-200 px-3"
                >
                  <option value="">Default template</option>
                  {(templates.data ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-500">Subject</span>
                <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-slate-500">
                  Message · {'{name}'}, {'{department}'}, {'{college_name}'}
                </span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={7}
                  className="w-full rounded-md border border-slate-200 p-3 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-3 text-sm md:col-span-2">
                {BIRTHDAY_CHANNELS.map((channel) => (
                  <label key={channel.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={channels.includes(channel.value)}
                      onChange={() =>
                        setChannels((current) =>
                          current.includes(channel.value)
                            ? current.filter((item) => item !== channel.value)
                            : [...current, channel.value],
                        )
                      }
                    />
                    {channel.label}
                  </label>
                ))}
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-950 md:col-span-2">
                <p className="font-medium">{preview.data?.subject || 'Preview'}</p>
                <p className="mt-2 whitespace-pre-wrap">
                  {preview.data?.body || 'Write a message to preview it.'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            {confirming ? (
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Back
              </Button>
            ) : null}
            <Button onClick={submitWish} disabled={send.isPending || !channels.length}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {confirming
                ? 'Send now'
                : composer && composer.length > 1
                  ? 'Review and send'
                  : 'Send wish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeopleTable({
  rows,
  loading,
  audience,
  selected,
  allSelected,
  onToggleAll,
  onToggle,
  onSend,
}: {
  rows: BirthdayPerson[];
  loading: boolean;
  audience: BirthdayAudience;
  selected: string[];
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  onSend: (person: BirthdayPerson) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select page"
              />
            </th>
            {[
              'Person',
              audience === 'STUDENT' ? 'Roll number' : 'Staff ID',
              'Department',
              audience === 'STUDENT' ? 'Class / semester' : 'Category',
              'Date of birth',
              'Contact',
              'Status',
              'Action',
            ].map((label) => (
              <th key={label} className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((person) => (
            <tr key={person.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.includes(person.id)}
                  onChange={() => onToggle(person.id)}
                  aria-label={`Select ${person.fullName}`}
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {person.photoUrl ? (
                    <img
                      src={person.photoUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                      {person.fullName.slice(0, 1)}
                    </span>
                  )}
                  <span>
                    <span className="block font-medium text-slate-900">{person.fullName}</span>
                    <span className="block text-xs text-slate-500">
                      {person.email || 'No email'}
                    </span>
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">{person.code || '—'}</td>
              <td className="px-3 py-2">{person.department || '—'}</td>
              <td className="px-3 py-2">
                {audience === 'STUDENT'
                  ? person.semester
                    ? `Semester ${person.semester}`
                    : person.programme || '—'
                  : person.staffType || '—'}
              </td>
              <td className="px-3 py-2">{formatDob(person.dateOfBirth)}</td>
              <td className="px-3 py-2">{person.contact || person.email || '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-1 text-xs font-medium',
                    STATUS_TONE[person.status],
                  )}
                >
                  {person.status}
                </span>
                {person.failureReason ? (
                  <span className="mt-1 block max-w-[180px] text-xs text-rose-600">
                    {person.failureReason}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Button size="sm" variant="outline" onClick={() => onSend(person)}>
                  {person.status === 'FAILED' ? 'Retry' : 'Send'}
                </Button>
              </td>
            </tr>
          ))}
          {!rows.length && !loading ? (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                No birthdays match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function MonthGrid({
  startWeekday,
  today,
  days,
  selected,
  label,
  onSelect,
  onShift,
}: {
  startWeekday: number;
  today: number | null;
  days: Array<{ day: number; students: number; staff: number }>;
  selected?: number;
  label: string;
  onSelect: (day: number) => void;
  onShift: (delta: number) => void;
}) {
  const cells = useMemo(() => {
    const leading = Array.from({ length: startWeekday }, () => null);
    return [...leading, ...days];
  }, [startWeekday, days]);
  return (
    <div className="border-b border-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => onShift(-1)}>
          Previous
        </Button>
        <p className="text-sm font-medium">{label}</p>
        <Button size="sm" variant="outline" onClick={() => onShift(1)}>
          Next
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name) => (
          <div key={name}>{name}</div>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.day}
              type="button"
              onClick={() => onSelect(cell.day)}
              className={cn(
                'rounded-lg border px-1 py-2',
                selected === cell.day
                  ? 'border-violet-400 bg-violet-50'
                  : today === cell.day
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-transparent hover:bg-slate-50',
              )}
            >
              <span className="block text-sm text-slate-800">{cell.day}</span>
              <span className="text-[10px] text-sky-700">{cell.students} stu</span>
              <span className="block text-[10px] text-indigo-700">{cell.staff} staff</span>
            </button>
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

function TemplatesPanel({
  templates,
  onCreated,
}: {
  templates: Array<{
    id: string;
    name: string;
    subject: string | null;
    bodyText: string | null;
    code: string;
  }>;
  onCreated: () => void;
}) {
  const [name, setName] = useState('College birthday card');
  const [audience, setAudience] = useState<'STUDENT' | 'STAFF' | 'BOTH'>('BOTH');
  const [subject, setSubject] = useState('Happy Birthday, {name}!');
  const [body, setBody] = useState(
    'Happy Birthday, {name}!\n\nWishing you a wonderful year filled with happiness, good health, success and countless blessings.\n\nWith best wishes,\n{college_name}',
  );
  const save = useMutation({
    mutationFn: saveBirthdayTemplate,
    onSuccess: () => onCreated(),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        {templates.map((template) => (
          <article key={template.id} className="rounded-xl border border-slate-100 p-3">
            <p className="font-medium text-slate-900">{template.name}</p>
            <p className="text-xs text-slate-500">{template.code}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{template.bodyText}</p>
          </article>
        ))}
        {!templates.length ? (
          <p className="text-sm text-slate-500">No birthday templates yet.</p>
        ) : null}
      </section>
      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ name, audience, subject, body });
        }}
      >
        <h2 className="font-semibold">New greeting card</h2>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Template name"
        />
        <select
          value={audience}
          onChange={(event) => setAudience(event.target.value as 'STUDENT' | 'STAFF' | 'BOTH')}
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
        >
          <option value="BOTH">Students and staff</option>
          <option value="STUDENT">Students</option>
          <option value="STAFF">Staff</option>
        </select>
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          className="w-full rounded-md border border-slate-200 p-3 text-sm"
        />
        <Button type="submit" disabled={save.isPending}>
          Save template
        </Button>
      </form>
    </div>
  );
}

function SettingsPanel({
  initial,
  templates,
  onSaved,
}: {
  initial: BirthdaySettings;
  templates: Array<{ code: string; name: string }>;
  onSaved: (next: BirthdaySettings) => void;
}) {
  const [form, setForm] = useState(initial);
  const save = useMutation({
    mutationFn: saveBirthdaySettings,
    onSuccess: (next) => onSaved(next),
  });
  function toggleChannel(value: string) {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(value)
        ? current.channels.filter((item) => item !== value)
        : [...current.channels, value],
    }));
  }
  return (
    <form
      className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          enabled: form.enabled,
          studentsEnabled: form.studentsEnabled,
          staffEnabled: form.staffEnabled,
          sendTime: form.sendTime,
          channels: form.channels,
          studentTemplateCode: form.studentTemplateCode,
          staffTemplateCode: form.staffTemplateCode,
          upcomingReminders: form.upcomingReminders,
          preventDuplicates: form.preventDuplicates,
          notifyPeers: form.notifyPeers,
        });
      }}
    >
      <Toggle
        label="Enable birthday automation"
        checked={form.enabled}
        onChange={(enabled) => setForm({ ...form, enabled })}
      />
      <Toggle
        label="Student birthday automation"
        checked={form.studentsEnabled}
        onChange={(studentsEnabled) => setForm({ ...form, studentsEnabled })}
      />
      <Toggle
        label="Staff birthday automation"
        checked={form.staffEnabled}
        onChange={(staffEnabled) => setForm({ ...form, staffEnabled })}
      />
      <Toggle
        label="Upcoming birthday reminders"
        checked={form.upcomingReminders}
        onChange={(upcomingReminders) => setForm({ ...form, upcomingReminders })}
      />
      <Toggle
        label="Duplicate notification prevention"
        checked={form.preventDuplicates}
        onChange={(preventDuplicates) => setForm({ ...form, preventDuplicates })}
      />
      <Toggle
        label="Also tell classmates and colleagues"
        checked={form.notifyPeers}
        onChange={(notifyPeers) => setForm({ ...form, notifyPeers })}
      />
      <label className="text-sm">
        <span className="mb-1 block text-slate-500">Scheduled sending time (IST)</span>
        <Input
          type="time"
          value={form.sendTime}
          onChange={(event) => setForm({ ...form, sendTime: event.target.value })}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-500">Student template</span>
        <select
          value={form.studentTemplateCode}
          onChange={(event) => setForm({ ...form, studentTemplateCode: event.target.value })}
          className="h-10 w-full rounded-md border border-slate-200 px-3"
        >
          <option value="STUDENT_BIRTHDAY_SELF">Student birthday greeting</option>
          {templates.map((template) => (
            <option key={template.code} value={template.code}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-slate-500">Staff template</span>
        <select
          value={form.staffTemplateCode}
          onChange={(event) => setForm({ ...form, staffTemplateCode: event.target.value })}
          className="h-10 w-full rounded-md border border-slate-200 px-3"
        >
          <option value="STAFF_BIRTHDAY_SELF">Staff birthday greeting</option>
          {templates.map((template) => (
            <option key={`staff-${template.code}`} value={template.code}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3 text-sm md:col-span-2">
        {BIRTHDAY_CHANNELS.map((channel) => (
          <label key={channel.value} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.channels.includes(channel.value)}
              onChange={() => toggleChannel(channel.value)}
            />
            {channel.label}
          </label>
        ))}
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={save.isPending}>
          Save automation
        </Button>
        {save.isError ? (
          <p className="mt-2 text-sm text-rose-600">
            {apiErrorMessage(save.error, 'Could not save settings.')}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium',
        active
          ? 'border-violet-300 bg-violet-50 text-violet-800'
          : 'border-slate-200 text-slate-600',
      )}
    >
      {children}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-sm">
      <span className="text-slate-500">
        {total} records · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
