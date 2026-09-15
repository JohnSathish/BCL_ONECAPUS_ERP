'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  deleteSchoolCalendarOverride,
  deleteSchoolHoliday,
  duplicateSchoolHoliday,
  fetchSchoolAcademicClasses,
  fetchSchoolCalendarDashboard,
  fetchSchoolCalendarMonth,
  fetchSchoolCalendarOverrides,
  fetchSchoolCalendarSetup,
  fetchSchoolCalendarYear,
  fetchSchoolHolidays,
  importSchoolHolidays,
  saveSchoolCalendarOverride,
  saveSchoolHoliday,
  saveSchoolWeeklyOff,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import {
  CalCard,
  CalendarShell,
  calField,
  downloadCsv,
  durationDays,
  fmtCalDate,
  kindClass,
  weekdayName,
} from './calendar-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WEEKDAYS = [
  { n: 0, label: 'Sunday' },
  { n: 1, label: 'Monday' },
  { n: 2, label: 'Tuesday' },
  { n: 3, label: 'Wednesday' },
  { n: 4, label: 'Thursday' },
  { n: 5, label: 'Friday' },
  { n: 6, label: 'Saturday' },
];

export function HolidayCalendarDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [yearId, setYearId] = useState('');
  const [view, setView] = useState<'calendar' | 'year' | 'list'>('calendar');
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [form, setForm] = useState({
    name: '',
    typeId: '',
    startDate: '',
    endDate: '',
    appliesTo: 'ALL',
    gradeIds: [] as string[],
    description: '',
    recurring: false,
    recurringRule: 'SAME_DATE',
  });

  const setup = useQuery({
    queryKey: ['school-cal-setup', yearId],
    queryFn: () => fetchSchoolCalendarSetup(yearId || undefined),
    enabled,
  });
  useEffect(() => {
    if (!yearId && setup.data?.year?.id) setYearId(setup.data.year.id);
  }, [setup.data, yearId]);
  const dash = useQuery({
    queryKey: ['school-cal-dash', yearId],
    queryFn: () => fetchSchoolCalendarDashboard(yearId || undefined),
    enabled,
  });
  const holidays = useQuery({
    queryKey: ['school-holidays', yearId],
    queryFn: () => fetchSchoolHolidays(yearId || undefined),
    enabled,
  });
  const month = useQuery({
    queryKey: ['school-cal-month', yearId, cursor.y, cursor.m],
    queryFn: () =>
      fetchSchoolCalendarMonth({
        year: cursor.y,
        month: cursor.m,
        academicYearId: yearId || undefined,
      }),
    enabled: enabled && view === 'calendar',
  });
  const yearView = useQuery({
    queryKey: ['school-cal-year', yearId],
    queryFn: () => fetchSchoolCalendarYear(yearId || undefined),
    enabled: enabled && view === 'year',
  });
  const overrides = useQuery({
    queryKey: ['school-cal-overrides', yearId],
    queryFn: () => fetchSchoolCalendarOverrides(yearId || undefined),
    enabled,
  });
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled: enabled && form.appliesTo === 'CLASSES',
  });

  const weekly = setup.data?.weekly;
  const [offDays, setOffDays] = useState<number[] | null>(null);
  const [satRule, setSatRule] = useState<string | null>(null);
  const weekdays = offDays ?? (Array.isArray(weekly?.weekdays) ? weekly.weekdays : [0]);
  const saturdayRule = satRule ?? weekly?.saturdayRule ?? 'NONE';

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['school-cal'] });
    void qc.invalidateQueries({ queryKey: ['school-holidays'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-dash'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-month'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-year'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-setup'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-overrides'] });
  };

  const save = useMutation({
    mutationFn: () =>
      saveSchoolHoliday(
        {
          ...form,
          endDate: form.endDate || form.startDate,
          academicYearId: yearId || setup.data?.year?.id,
          overrideConflict,
        },
        editing?.id,
      ),
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setError(null);
      setOverrideConflict(false);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSchoolHoliday(id),
    onSuccess: () => {
      setConfirmDel(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const dup = useMutation({
    mutationFn: (id: string) => duplicateSchoolHoliday(id),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const weeklyMut = useMutation({
    mutationFn: () =>
      saveSchoolWeeklyOff({
        weekdays,
        saturdayRule,
        academicYearId: yearId || setup.data?.year?.id,
      }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const overrideMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveSchoolCalendarOverride(payload),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const importMut = useMutation({
    mutationFn: (confirm?: boolean) =>
      importSchoolHolidays({
        rows: importRows,
        confirm,
        academicYearId: yearId || setup.data?.year?.id,
      }),
    onSuccess: (data) => {
      setImportPreview(data);
      if (data.imported) {
        setImportOpen(false);
        invalidate();
      }
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [specDate, setSpecDate] = useState('');
  const [specReason, setSpecReason] = useState('');

  const cards = useMemo(
    () => [
      { label: 'Total Holidays', value: dash.data?.totalHolidays ?? 0 },
      { label: 'Government Holidays', value: dash.data?.governmentHolidays ?? 0 },
      { label: 'School Holidays', value: dash.data?.schoolHolidays ?? 0 },
      { label: 'Vacation Days', value: dash.data?.vacationDays ?? 0 },
      { label: 'Working Days', value: dash.data?.workingDays ?? 0 },
    ],
    [dash.data],
  );

  function openEdit(row?: any) {
    setEditing(row ?? null);
    setForm({
      name: row?.name ?? '',
      typeId: row?.typeId ?? setup.data?.types?.[0]?.id ?? '',
      startDate: row?.startDate?.slice(0, 10) ?? '',
      endDate: row?.endDate?.slice(0, 10) ?? '',
      appliesTo: row?.appliesTo ?? 'ALL',
      gradeIds: Array.isArray(row?.gradeIds) ? row.gradeIds : [],
      description: row?.description ?? '',
      recurring: !!row?.recurring,
      recurringRule: row?.recurringRule ?? 'SAME_DATE',
    });
    setOpen(true);
  }

  function exportList() {
    downloadCsv(
      'holiday-calendar.csv',
      ['Date', 'Day', 'Holiday', 'Type', 'Applies To', 'Duration', 'Status'],
      (holidays.data ?? []).map((h: any) => [
        fmtCalDate(h.startDate),
        weekdayName(h.startDate),
        h.name,
        h.type?.name,
        h.appliesTo,
        `${durationDays(h.startDate, h.endDate)} Day`,
        h.status,
      ]),
    );
  }

  const pad = month.data?.cells?.[0]
    ? (new Date(month.data.cells[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7
    : 0;

  return (
    <CalendarShell
      title="Holiday Calendar"
      subtitle="Manage holidays, vacations, weekly offs and special working days for the academic year."
      extra={
        <div className="flex flex-wrap items-center gap-2">
          <select className={calField} value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {(setup.data?.years ?? []).map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          {canManage ? <PrimaryButton onClick={() => openEdit()}>Add Holiday</PrimaryButton> : null}
          {canManage ? <GhostButton onClick={() => setImportOpen(true)}>Import</GhostButton> : null}
          <GhostButton onClick={exportList}>Export Excel</GhostButton>
          <GhostButton onClick={() => window.print()}>Print / PDF</GhostButton>
        </div>
      }
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {dash.isLoading ? <p className="text-sm text-slate-500">Loading calendar…</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <CalCard key={c.label}>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#1e3a8a]">{c.value}</p>
          </CalCard>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['calendar', 'year', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${view === v ? 'bg-[#2563eb] text-white ring-[#2563eb]' : 'bg-white text-slate-600 ring-slate-200'}`}
          >
            {v === 'calendar' ? 'Calendar' : v === 'year' ? 'Year' : 'List'}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <CalCard>
          <div className="mb-3 flex items-center justify-between">
            <GhostButton
              onClick={() =>
                setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }))
              }
            >
              Previous
            </GhostButton>
            <p className="font-semibold text-[#1e3a8a]">
              {new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
            <GhostButton
              onClick={() =>
                setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }))
              }
            >
              Next
            </GhostButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: pad }).map((_, i) => (
              <div key={`p${i}`} />
            ))}
            {(month.data?.cells ?? []).map((c: any) => (
              <button
                type="button"
                key={c.date}
                onClick={() => setDetail(c)}
                className={`min-h-[72px] rounded-lg p-1 text-left text-xs ring-1 ring-slate-100 ${kindClass(c.kind)}`}
              >
                <span className="font-semibold">{c.date.slice(8)}</span>
                <p className="truncate text-[10px] uppercase">{c.kind.replace(/_/g, ' ')}</p>
                {c.items?.[0] ? <p className="truncate text-[10px]">{c.items[0].title}</p> : null}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {[
              'WORKING_DAY',
              'WEEKLY_OFF',
              'HOLIDAY',
              'VACATION',
              'SPECIAL_WORKING_DAY',
              'EXAMINATION',
            ].map((k) => (
              <span key={k} className={`rounded-full px-2 py-0.5 ${kindClass(k)}`}>
                {k.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </CalCard>
      ) : null}

      {view === 'year' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(yearView.data?.months ?? []).map((m: any) => (
            <CalCard key={m.label}>
              <p className="mb-2 text-sm font-semibold text-[#1e3a8a]">{m.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {m.days.map((d: any) => (
                  <span
                    key={d.date}
                    title={`${d.date} ${d.kind}`}
                    className={`h-3 w-3 rounded-sm ${kindClass(d.kind)} ring-1 ring-black/5`}
                  />
                ))}
              </div>
            </CalCard>
          ))}
        </div>
      ) : null}

      {view === 'list' ? (
        <CalCard>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  {[
                    'Date',
                    'Day',
                    'Holiday',
                    'Type',
                    'Applies To',
                    'Duration',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="px-2 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(holidays.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-center text-slate-500">
                      No holidays yet for this academic year.
                    </td>
                  </tr>
                ) : (
                  (holidays.data ?? []).map((h: any) => (
                    <tr key={h.id} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        {fmtCalDate(h.startDate)}
                        {h.endDate !== h.startDate ? ` – ${fmtCalDate(h.endDate)}` : ''}
                      </td>
                      <td className="px-2 py-2">{weekdayName(h.startDate)}</td>
                      <td className="px-2 py-2 font-medium">{h.name}</td>
                      <td className="px-2 py-2">{h.type?.name}</td>
                      <td className="px-2 py-2">{h.appliesTo}</td>
                      <td className="px-2 py-2">{durationDays(h.startDate, h.endDate)} Day</td>
                      <td className="px-2 py-2">{h.status}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <GhostButton onClick={() => setDetail(h)}>View</GhostButton>
                          {canManage ? (
                            <GhostButton onClick={() => openEdit(h)}>Edit</GhostButton>
                          ) : null}
                          {canManage ? (
                            <GhostButton onClick={() => dup.mutate(h.id)}>Duplicate</GhostButton>
                          ) : null}
                          {canManage ? (
                            <GhostButton onClick={() => setConfirmDel(h)}>Delete</GhostButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CalCard>
      ) : null}

      {canManage ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <CalCard>
            <p className="mb-2 font-semibold text-[#1e3a8a]">Weekly off</p>
            <p className="mb-3 text-xs text-slate-500">
              Different schools use different weekly holidays. Nothing is assumed except the saved
              configuration.
            </p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label key={d.n} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(d.n)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...weekdays, d.n]
                        : weekdays.filter((x: number) => x !== d.n);
                      setOffDays(next);
                    }}
                  />
                  {d.label}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Saturday rule
              <select
                className={`${calField} mt-1`}
                value={saturdayRule}
                onChange={(e) => setSatRule(e.target.value)}
              >
                <option value="NONE">Not used unless Saturday is ticked</option>
                <option value="EVERY">Every Saturday</option>
                <option value="FIRST_THIRD">1st & 3rd Saturday</option>
                <option value="SECOND_FOURTH">2nd & 4th Saturday</option>
                <option value="ALTERNATE">Alternate Saturday</option>
                <option value="CUSTOM">Custom weeks</option>
              </select>
            </label>
            <PrimaryButton className="mt-3" onClick={() => weeklyMut.mutate()}>
              Save weekly off
            </PrimaryButton>
          </CalCard>
          <CalCard>
            <p className="mb-2 font-semibold text-[#1e3a8a]">Special working day</p>
            <p className="mb-3 text-xs text-slate-500">
              Overrides a holiday or weekly off so attendance and working-day counts treat it as a
              working day.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                className={calField}
                value={specDate}
                onChange={(e) => setSpecDate(e.target.value)}
              />
              <input
                className={calField}
                placeholder="Reason"
                value={specReason}
                onChange={(e) => setSpecReason(e.target.value)}
              />
            </div>
            <PrimaryButton
              className="mt-3"
              disabled={!specDate}
              onClick={() =>
                overrideMut.mutate({
                  date: specDate,
                  reason: specReason,
                  academicYearId: yearId || setup.data?.year?.id,
                })
              }
            >
              Add special working day
            </PrimaryButton>
            <ul className="mt-3 space-y-1 text-sm">
              {(overrides.data ?? []).map((o: any) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span>
                    {fmtCalDate(o.date)} · {o.reason || o.kind}
                  </span>
                  <GhostButton onClick={() => deleteSchoolCalendarOverride(o.id).then(invalidate)}>
                    Remove
                  </GhostButton>
                </li>
              ))}
            </ul>
          </CalCard>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit holiday' : 'Add holiday'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <input
              className={calField}
              placeholder="Holiday name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className={calField}
              value={form.typeId}
              onChange={(e) => setForm({ ...form, typeId: e.target.value })}
            >
              {(setup.data?.types ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className={calField}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
              <input
                type="date"
                className={calField}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <p className="text-xs text-slate-500">
              Duration: {durationDays(form.startDate, form.endDate || form.startDate)} day(s)
            </p>
            <select
              className={calField}
              value={form.appliesTo}
              onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
            >
              <option value="ALL">All</option>
              <option value="STUDENTS">Students</option>
              <option value="TEACHING">Teaching Staff</option>
              <option value="NON_TEACHING">Non-Teaching Staff</option>
              <option value="CLASSES">Selected Classes</option>
              <option value="SECTIONS">Selected Sections</option>
            </select>
            {form.appliesTo === 'CLASSES' ? (
              <div className="flex flex-wrap gap-1">
                {(classes.data?.grades ?? []).map((g: any) => {
                  const on = form.gradeIds.includes(g.id);
                  return (
                    <button
                      type="button"
                      key={g.id}
                      className={`rounded-full px-2 py-1 text-xs ring-1 ${on ? 'bg-[#2563eb] text-white' : 'bg-white'}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          gradeIds: on
                            ? form.gradeIds.filter((id) => id !== g.id)
                            : [...form.gradeIds, g.id],
                        })
                      }
                    >
                      {g.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <textarea
              className="min-h-[70px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
              Repeat every academic year
            </label>
            {form.recurring ? (
              <select
                className={calField}
                value={form.recurringRule}
                onChange={(e) => setForm({ ...form, recurringRule: e.target.value })}
              >
                <option value="SAME_DATE">Same calendar date</option>
                <option value="SAME_WEEKDAY">Same weekday of the month</option>
              </select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overrideConflict}
                onChange={(e) => setOverrideConflict(e.target.checked)}
              />
              Override overlap warning
            </label>
          </div>
          <DialogFooter>
            <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            <PrimaryButton
              disabled={!form.name || !form.startDate || save.isPending}
              onClick={() => save.mutate()}
            >
              Save
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete holiday?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            “{confirmDel?.name}” will be removed from the holiday calendar. Linked academic calendar
            entries are removed with it.
          </p>
          <DialogFooter>
            <GhostButton onClick={() => setConfirmDel(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => remove.mutate(confirmDel.id)}>Delete</PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.name || detail?.date}</DialogTitle>
          </DialogHeader>
          {detail?.kind ? (
            <p className="text-sm">{String(detail.kind).replace(/_/g, ' ')}</p>
          ) : null}
          {detail?.type ? (
            <p className="text-sm">
              {detail.type.name} · {fmtCalDate(detail.startDate)}
            </p>
          ) : null}
          {detail?.items?.length
            ? detail.items.map((i: any) => (
                <p key={i.id} className="text-sm">
                  {i.title} · {i.category?.name}
                </p>
              ))
            : null}
          {detail?.description ? (
            <p className="text-sm text-slate-600">{detail.description}</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import holidays</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            CSV columns: Holiday Name, Start Date, End Date, Type, Applies To, Description
          </p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const text = await f.text();
              const lines = text.trim().split(/\r?\n/);
              lines.shift();
              setImportRows(
                lines.map((line) => {
                  const [name, startDate, endDate, type, appliesTo, description] = line
                    .split(',')
                    .map((x) => x.trim().replace(/^"|"$/g, ''));
                  return { name, startDate, endDate, type, appliesTo, description };
                }),
              );
            }}
          />
          <GhostButton
            onClick={() => {
              downloadCsv(
                'holiday-import-template.csv',
                ['Holiday Name', 'Start Date', 'End Date', 'Type', 'Applies To', 'Description'],
                [['Independence Day', '2026-08-15', '2026-08-15', 'Government Holiday', 'ALL', '']],
              );
            }}
          >
            Download template
          </GhostButton>
          {importPreview ? (
            <p className="text-sm">
              Valid: {importPreview.valid} · Invalid: {importPreview.invalid}
              {(importPreview.errors ?? []).slice(0, 6).map((er: any) => (
                <span key={er.row} className="block text-rose-700">
                  Row {er.row}: {er.message}
                </span>
              ))}
            </p>
          ) : null}
          <DialogFooter>
            <GhostButton onClick={() => importMut.mutate(undefined)}>Validate</GhostButton>
            <PrimaryButton disabled={!importRows.length} onClick={() => importMut.mutate(true)}>
              Confirm import
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CalendarShell>
  );
}
