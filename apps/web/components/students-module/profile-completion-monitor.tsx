'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, Send, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { fetchShifts } from '@/services/academic-engine';
import { fetchAcademicYears, fetchDepartments } from '@/services/organization';
import {
  exportProfileMonitor,
  fetchProfileMonitor,
  fetchProfileMonitorAnalytics,
  fetchProfileMonitorHistory,
  fetchProfileMonitorIds,
  saveProfileMonitorSettings,
  sendProfileReminder,
  type MonitorFilters,
} from '@/services/profile-completion-monitor';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

const BADGE = [
  'bg-rose-100 text-rose-800',
  'bg-amber-100 text-amber-800',
  'bg-orange-100 text-orange-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
];

const DEFAULT_MESSAGE = `Dear {student_name},

Our records show that you have not updated the following profile details: {missing_fields}.

Please log in to the Don Bosco College App and update them as soon as possible.

Thank you.

IT Team
Don Bosco College, Tura`;

export function ProfileCompletionMonitor() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<MonitorFilters>({
    status: 'incomplete',
    page: 1,
    pageSize: 10,
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'PUSH'>('WHATSAPP');
  const [audience, setAudience] = useState<'incomplete' | 'selected' | 'missing_field'>(
    'incomplete',
  );
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);

  const monitorQ = useQuery({
    queryKey: ['profile-monitor', filters],
    queryFn: () => fetchProfileMonitor(filters),
  });
  const analyticsQ = useQuery({
    queryKey: ['profile-monitor', 'analytics', filters],
    queryFn: () =>
      fetchProfileMonitorAnalytics({
        ...filters,
        page: undefined,
        pageSize: undefined,
        status: 'all',
      }),
  });
  const historyQ = useQuery({
    queryKey: ['profile-monitor', 'history'],
    queryFn: () => fetchProfileMonitorHistory(1),
  });
  const yearsQ = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const departmentsQ = useQuery({ queryKey: ['departments'], queryFn: () => fetchDepartments() });
  const shiftsQ = useQuery({ queryKey: ['shifts', 'monitor'], queryFn: () => fetchShifts() });

  const rows = monitorQ.data?.rows ?? [];
  const summary = monitorQ.data?.summary;
  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, on]) => on)
        .map(([id]) => id),
    [selected],
  );
  const missingFieldCount =
    analyticsQ.data?.byField.find((field) => field.key === filters.missingField)?.missing ?? 0;
  const recipientCount =
    audience === 'selected'
      ? selectedIds.length
      : audience === 'missing_field'
        ? missingFieldCount
        : (summary?.incomplete ?? 0);

  const patch = (next: Partial<MonitorFilters>) => {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
    setSelected({});
  };

  const sendMut = useMutation({
    mutationFn: () =>
      sendProfileReminder({
        ...filters,
        page: undefined,
        pageSize: undefined,
        channel,
        audience,
        message,
        studentIds: audience === 'selected' ? selectedIds : undefined,
        status: audience === 'selected' ? 'all' : 'incomplete',
      }),
    onSuccess: async (result) => {
      setConfirming(false);
      setNotice(
        `Reminder finished. ${result.success} confirmed, ${result.failed} failed, ${result.skipped} skipped.`,
      );
      await qc.invalidateQueries({ queryKey: ['profile-monitor', 'history'] });
    },
    onError: (error) => {
      setConfirming(false);
      setNotice(apiErrorMessage(error, 'Reminder was not sent'));
    },
  });

  const settingsMut = useMutation({
    mutationFn: (requiredKeys: string[]) =>
      saveProfileMonitorSettings({ requiredKeys, reminderIntervalHours: 24 }),
    onSuccess: async () => {
      setNotice('Required fields saved. Completion counts now use this list.');
      await qc.invalidateQueries({ queryKey: ['profile-monitor'] });
    },
    onError: (error) => setNotice(apiErrorMessage(error, 'Could not save required fields')),
  });

  const pages = Math.max(1, Math.ceil((monitorQ.data?.total ?? 0) / (filters.pageSize ?? 10)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Profile Completion Monitor</h1>
            <p className="text-sm text-slate-500">
              Track students who have not completed their mandatory profile details and send
              reminders.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const blob = await exportProfileMonitor(
                filters,
                selectedIds.length ? selectedIds : undefined,
              );
              downloadBlob(blob, 'profile-completion-monitor.xlsx');
            } catch (error) {
              setNotice(apiErrorMessage(error, 'Export failed'));
            }
          }}
        >
          <Download className="mr-1 h-4 w-4" />
          Export List
        </Button>
      </div>

      {notice ? (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{notice}</p>
      ) : null}
      {monitorQ.isError ? (
        <QueryErrorPanel
          title="Unable to load profile completion"
          error={monitorQ.error}
          onRetry={() => void monitorQ.refetch()}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Total Students"
          value={summary?.total ?? 0}
          tone="bg-blue-50 text-blue-700"
          icon={<Users className="h-5 w-5" />}
        />
        <Card
          label="Profile Complete"
          value={summary?.complete ?? 0}
          hint={`${summary?.completePercent ?? 0}%`}
          tone="bg-emerald-50 text-emerald-700"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <Card
          label="Incomplete Profiles"
          value={summary?.incomplete ?? 0}
          hint={`${summary?.incompletePercent ?? 0}%`}
          tone="bg-amber-50 text-amber-700"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <Card
          label="Pending Verification"
          value={summary?.pendingVerification ?? 0}
          tone="bg-rose-50 text-rose-700"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Students with Incomplete Profiles</h2>
            <p className="text-xs text-slate-500">
              Counts come from the stored profile, not from app login.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            <Select
              label="Academic Year"
              value={filters.academicYearId ?? ''}
              onChange={(value) => patch({ academicYearId: value })}
            >
              <option value="">All years</option>
              {(yearsQ.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
            <Select
              label="Department"
              value={filters.departmentId ?? ''}
              onChange={(value) => patch({ departmentId: value })}
            >
              <option value="">All Departments</option>
              {(departmentsQ.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              label="Semester"
              value={filters.semester ?? ''}
              onChange={(value) => patch({ semester: value })}
            >
              <option value="">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </Select>
            <Select
              label="Shift"
              value={filters.shiftId ?? ''}
              onChange={(value) => patch({ shiftId: value })}
            >
              <option value="">All Shifts</option>
              {(shiftsQ.data ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </Select>
            <Select
              label="Gender"
              value={filters.gender ?? ''}
              onChange={(value) => patch({ gender: value })}
            >
              <option value="">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Select
              label="Missing Field"
              value={filters.missingField ?? ''}
              onChange={(value) => patch({ missingField: value })}
            >
              <option value="">All Missing Fields</option>
              {(monitorQ.data?.fields ?? []).map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </Select>
            <Select
              label="Completion"
              value={filters.status ?? 'incomplete'}
              onChange={(value) => patch({ status: value as MonitorFilters['status'] })}
            >
              <option value="incomplete">Incomplete</option>
              <option value="complete">Complete</option>
              <option value="all">All students</option>
            </Select>
            <label className="text-xs font-medium text-slate-600">
              Search
              <Input
                className="mt-1"
                placeholder="Name, roll number, or mobile"
                value={filters.search ?? ''}
                onChange={(event) => patch({ search: event.target.value })}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">
              {monitorQ.data?.total ?? 0} students found
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.length}
              onClick={() => {
                const next = { ...selected };
                for (const row of rows) next[row.studentId] = true;
                setSelected(next);
              }}
            >
              Select page
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const ids = await fetchProfileMonitorIds(filters);
                const next: Record<string, boolean> = {};
                for (const id of ids) next[id] = true;
                setSelected(next);
              }}
            >
              Select all filtered
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
              Clear
            </Button>
            <span className="text-slate-500">{selectedIds.length} selected</span>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-800 text-left text-[11px] font-semibold uppercase tracking-wide text-white">
                <tr>
                  <th className="px-3 py-2"> </th>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Roll No.</th>
                  <th className="px-3 py-2">Student Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Sem</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2">Missing Profile Fields</th>
                  <th className="px-3 py-2">Mobile</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {monitorQ.isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                      Loading students…
                    </td>
                  </tr>
                ) : null}
                {rows.map((row, index) => (
                  <tr key={row.studentId} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.studentId])}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [row.studentId]: event.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      {((filters.page ?? 1) - 1) * (filters.pageSize ?? 10) + index + 1}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.rollNumber ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold uppercase">{row.fullName}</td>
                    <td className="px-3 py-2">{row.department}</td>
                    <td className="px-3 py-2">{row.semester}</td>
                    <td className="px-3 py-2">{row.shift}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {row.missing.length ? (
                          row.missing.map((field, badge) => (
                            <span
                              key={field.key}
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[badge % BADGE.length]}`}
                            >
                              {field.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-emerald-700">Complete</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.mobileNumber ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold">{row.percent}%</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/students/${row.studentId}`}
                        className="text-xs font-semibold text-blue-700 underline"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
                {!monitorQ.isLoading && !rows.length ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-slate-500">
                      No students match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Page {filters.page ?? 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => patch({ page: (filters.page ?? 1) - 1 })}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(filters.page ?? 1) >= pages}
                onClick={() => patch({ page: (filters.page ?? 1) + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Send Message to Students</h2>
          <p className="text-xs text-slate-500">
            A send is counted only when the gateway confirms it.
          </p>
          <fieldset className="space-y-1 text-sm">
            <legend className="text-xs font-semibold uppercase text-slate-500">Send to</legend>
            <label className="flex gap-2">
              <input
                type="radio"
                checked={audience === 'incomplete'}
                onChange={() => setAudience('incomplete')}
              />{' '}
              All incomplete in this filter ({summary?.incomplete ?? 0})
            </label>
            <label className="flex gap-2">
              <input
                type="radio"
                checked={audience === 'selected'}
                onChange={() => setAudience('selected')}
              />{' '}
              Selected students ({selectedIds.length})
            </label>
            <label className="flex gap-2">
              <input
                type="radio"
                checked={audience === 'missing_field'}
                onChange={() => setAudience('missing_field')}
              />{' '}
              Students missing the filtered field
            </label>
          </fieldset>
          <div className="grid grid-cols-3 gap-2">
            {(['WHATSAPP', 'SMS', 'PUSH'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-xl border px-2 py-3 text-xs font-semibold ${channel === item ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200'}`}
                onClick={() => setChannel(item)}
              >
                {item === 'WHATSAPP' ? 'WhatsApp' : item === 'SMS' ? 'SMS' : 'Push'}
                <span className="mt-1 block font-normal text-slate-500">
                  {item === 'WHATSAPP' && monitorQ.data && !monitorQ.data.channels.whatsapp
                    ? 'Not configured'
                    : null}
                  {item === 'SMS' && monitorQ.data && !monitorQ.data.channels.sms
                    ? 'Not configured'
                    : null}
                  {item === 'PUSH' && monitorQ.data && !monitorQ.data.channels.push
                    ? 'Not configured'
                    : null}
                  {(item === 'WHATSAPP' && monitorQ.data?.channels.whatsapp) ||
                  (item === 'SMS' && monitorQ.data?.channels.sms) ||
                  (item === 'PUSH' && monitorQ.data?.channels.push)
                    ? 'Ready'
                    : null}
                </span>
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-slate-600">
            Message
            <textarea
              className="mt-1 min-h-40 w-full rounded-lg border border-slate-200 p-2 text-sm"
              value={message}
              maxLength={500}
              onChange={(event) => setMessage(event.target.value)}
            />
            <span className="text-slate-400">
              {message.length}/500 · placeholders: {'{student_name}'} {'{roll_number}'}{' '}
              {'{missing_fields}'} {'{college_name}'}
            </span>
          </label>
          <p className="text-sm font-medium text-slate-700">
            Recipients ready to attempt: {recipientCount}
          </p>
          {confirming ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p>
                Send this {channel} reminder to{' '}
                {audience === 'selected' ? selectedIds.length : recipientCount} students?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white"
                  disabled={sendMut.isPending}
                  onClick={() => sendMut.mutate()}
                >
                  {sendMut.isPending ? 'Sending…' : 'Confirm send'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={
                !message.trim() ||
                sendMut.isPending ||
                (audience === 'missing_field' && !filters.missingField) ||
                recipientCount === 0
              }
              onClick={() => setConfirming(true)}
            >
              <Send className="mr-1 h-4 w-4" />
              Send {channel === 'WHATSAPP' ? 'WhatsApp' : channel === 'SMS' ? 'SMS' : 'Push'}{' '}
              Message
            </Button>
          )}
        </aside>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Field completion</h2>
          <p className="text-xs text-slate-500">
            A student missing several fields is counted in each field, and once in the incomplete
            total ({analyticsQ.data?.incompleteStudents ?? 0}). Multiple missing:{' '}
            {analyticsQ.data?.multipleMissing ?? 0}.
          </p>
          <div className="mt-3 space-y-2">
            {(analyticsQ.data?.byField ?? []).map((field) => (
              <div key={field.key}>
                <div className="flex justify-between text-xs">
                  <span>{field.label}</span>
                  <span>
                    {field.filledPercent}% filled · {field.missing} missing
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-700"
                    style={{ width: `${field.filledPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Department completion</h2>
          <div className="mt-3 space-y-2">
            {(analyticsQ.data?.byDepartment ?? []).map((row) => (
              <div key={row.department}>
                <div className="flex justify-between text-xs">
                  <span>{row.department}</span>
                  <span>
                    {row.completePercent}% · {row.complete}/{row.students}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-600"
                    style={{ width: `${row.completePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Required fields</h2>
        <p className="text-xs text-slate-500">
          Only ticked fields count as missing. Optional details stay out of the score.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {(monitorQ.data?.fields ?? []).map((field) => {
            const checked = (monitorQ.data?.requiredKeys ?? []).includes(field.key);
            return (
              <label key={field.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const current = monitorQ.data?.requiredKeys ?? [];
                    const next = checked
                      ? current.filter((key) => key !== field.key)
                      : [...current, field.key];
                    if (next.length) settingsMut.mutate(next);
                  }}
                />
                {field.label}
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Message history</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Date</th>
                <th>Type</th>
                <th>Recipients</th>
                <th>Successful</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Sent by</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {(historyQ.data?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.channel}</td>
                  <td>{row.recipients}</td>
                  <td>{row.successful}</td>
                  <td>
                    {row.failed}
                    {row.failures[0] ? (
                      <span className="block text-xs text-rose-700">{row.failures[0]}</span>
                    ) : null}
                  </td>
                  <td>{row.skipped}</td>
                  <td>{row.sentBy}</td>
                  <td className="max-w-xs whitespace-pre-wrap text-xs text-slate-600">
                    {row.message}
                  </td>
                </tr>
              ))}
              {!historyQ.isLoading && !historyQ.data?.rows.length ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    No reminders sent yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  tone: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${tone}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {value.toLocaleString()}{' '}
          {hint ? <span className="text-sm font-medium text-slate-500">{hint}</span> : null}
        </p>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
