'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import {
  deleteSchoolCalendarEvent,
  fetchSchoolAcademicClasses,
  fetchSchoolCalendarEvents,
  fetchSchoolCalendarMonth,
  fetchSchoolCalendarSetup,
  fetchSchoolSisStaff,
  saveSchoolAcademicTerms,
  saveSchoolCalendarEvent,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import {
  CalCard,
  CalendarShell,
  calField,
  downloadCsv,
  fmtCalDate,
  kindClass,
} from './calendar-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AcademicCalendarDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [yearId, setYearId] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  });
  const [form, setForm] = useState<any>({
    title: '',
    categoryId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    allDay: true,
    description: '',
    audience: ['EVERYONE'],
    gradeIds: [] as string[],
    location: '',
    organizerType: 'ADMIN',
    organizerStaffId: '',
    status: 'SCHEDULED',
    importantParents: false,
    importantStudents: false,
    importantTeachers: false,
    notifyParents: false,
    notifyStudents: false,
    notifyTeachers: false,
    ptmVenue: '',
    ptmInstructions: '',
  });

  const setup = useQuery({
    queryKey: ['school-cal-setup', yearId],
    queryFn: () => fetchSchoolCalendarSetup(yearId || undefined),
    enabled,
  });
  useEffect(() => {
    if (!yearId && setup.data?.year?.id) setYearId(setup.data.year.id);
  }, [setup.data, yearId]);

  const events = useQuery({
    queryKey: ['school-cal-events', yearId, categoryId, status],
    queryFn: () =>
      fetchSchoolCalendarEvents({
        academicYearId: yearId || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
      }),
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
  const classes = useQuery({
    queryKey: ['school-academic-classes'],
    queryFn: fetchSchoolAcademicClasses,
    enabled,
  });
  const staff = useQuery({
    queryKey: ['school-sis-staff'],
    queryFn: fetchSchoolSisStaff,
    enabled: enabled && canManage,
  });

  const cat = (setup.data?.categories ?? []).find((c: any) => c.id === form.categoryId);
  const isPtm = cat?.code === 'PTM';

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['school-cal-events'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-month'] });
    void qc.invalidateQueries({ queryKey: ['school-cal-setup'] });
  };

  const save = useMutation({
    mutationFn: () =>
      saveSchoolCalendarEvent(
        {
          ...form,
          endDate: form.endDate || form.startDate,
          academicYearId: yearId || setup.data?.year?.id,
          overrideConflict,
          ptm: isPtm
            ? {
                venue: form.ptmVenue,
                instructions: form.ptmInstructions,
                startTime: form.startTime,
                endTime: form.endTime,
              }
            : undefined,
        },
        editing?.id,
      ),
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSchoolCalendarEvent(id),
    onSuccess: () => {
      setConfirmDel(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const [termsText, setTermsText] = useState('');
  useEffect(() => {
    if (setup.data?.terms) {
      setTermsText((setup.data.terms as any[]).map((t) => t.name).join('\n'));
    }
  }, [setup.data]);
  const saveTerms = useMutation({
    mutationFn: () =>
      saveSchoolAcademicTerms({
        academicYearId: yearId || setup.data?.year?.id,
        terms: termsText
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((name, i) => ({ name, sortOrder: i })),
      }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const filtered = useMemo(() => {
    let rows = events.data ?? [];
    if (categoryId) rows = rows.filter((e: any) => e.categoryId === categoryId);
    return rows;
  }, [events.data, categoryId]);

  const pad = month.data?.cells?.[0]
    ? (new Date(month.data.cells[0].date + 'T00:00:00Z').getUTCDay() + 6) % 7
    : 0;

  function openEdit(row?: any) {
    setEditing(row ?? null);
    setForm({
      title: row?.title ?? '',
      categoryId: row?.categoryId ?? setup.data?.categories?.[0]?.id ?? '',
      startDate: row?.startDate?.slice(0, 10) ?? '',
      endDate: row?.endDate?.slice(0, 10) ?? '',
      startTime: row?.startTime ?? '',
      endTime: row?.endTime ?? '',
      allDay: row?.allDay ?? true,
      description: row?.description ?? '',
      audience: Array.isArray(row?.audience) && row.audience.length ? row.audience : ['EVERYONE'],
      gradeIds: Array.isArray(row?.gradeIds) ? row.gradeIds : [],
      location: row?.location ?? '',
      organizerType: row?.organizerType ?? 'ADMIN',
      organizerStaffId: row?.organizerStaffId ?? '',
      status: row?.status ?? 'SCHEDULED',
      importantParents: !!row?.importantParents,
      importantStudents: !!row?.importantStudents,
      importantTeachers: !!row?.importantTeachers,
      notifyParents: !!row?.notifyParents,
      notifyStudents: !!row?.notifyStudents,
      notifyTeachers: !!row?.notifyTeachers,
      ptmVenue: row?.ptm?.venue ?? '',
      ptmInstructions: row?.ptm?.instructions ?? '',
    });
    setOpen(true);
  }

  return (
    <CalendarShell
      title="Academic Calendar"
      subtitle="Plan and manage the complete academic year's academic, examination, administrative and extracurricular activities."
      extra={
        <div className="flex max-w-full flex-wrap gap-2 overflow-x-auto">
          <select className={calField} value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {(setup.data?.years ?? []).map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <select
            className={calField}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All categories</option>
            {(setup.data?.categories ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className={calField} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            type="button"
            className={`h-10 rounded-lg px-3 text-sm ${view === 'calendar' ? 'bg-[#2563eb] text-white' : 'bg-white ring-1 ring-slate-200'}`}
            onClick={() => setView('calendar')}
          >
            Calendar
          </button>
          <button
            type="button"
            className={`h-10 rounded-lg px-3 text-sm ${view === 'list' ? 'bg-[#2563eb] text-white' : 'bg-white ring-1 ring-slate-200'}`}
            onClick={() => setView('list')}
          >
            List
          </button>
          {canManage ? <PrimaryButton onClick={() => openEdit()}>Add Event</PrimaryButton> : null}
          <GhostButton
            onClick={() =>
              downloadCsv(
                'academic-calendar.csv',
                ['Date', 'Event', 'Category', 'Status'],
                filtered.map((e: any) => [
                  fmtCalDate(e.startDate),
                  e.title,
                  e.category?.name,
                  e.status,
                ]),
              )
            }
          >
            Export
          </GhostButton>
          <GhostButton onClick={() => window.print()}>Print / PDF</GhostButton>
        </div>
      }
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {canManage ? (
        <CalCard>
          <p className="mb-1 font-semibold text-[#1e3a8a]">Academic terms</p>
          <p className="mb-2 text-xs text-slate-500">
            Year {setup.data?.year?.name}: {fmtCalDate(setup.data?.year?.startDate)} –{' '}
            {fmtCalDate(setup.data?.year?.endDate)}. One term name per line.
          </p>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
          />
          <PrimaryButton className="mt-2" onClick={() => saveTerms.mutate()}>
            Save terms
          </PrimaryButton>
        </CalCard>
      ) : null}

      {view === 'calendar' ? (
        <CalCard>
          <div className="mb-3 flex items-center justify-between">
            <GhostButton
              onClick={() =>
                setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { ...c, m: c.m - 1 }))
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
                setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { ...c, m: c.m + 1 }))
              }
            >
              Next
            </GhostButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d}>{d}</div>
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
                className={`min-h-[80px] rounded-lg p-1 text-left text-xs ring-1 ring-slate-100 ${kindClass(c.kind)}`}
              >
                <span className="font-semibold">{c.date.slice(8)}</span>
                {(c.items ?? []).slice(0, 2).map((i: any) => (
                  <p key={i.id} className="truncate" style={{ color: i.category?.color }}>
                    {i.title}
                  </p>
                ))}
              </button>
            ))}
          </div>
        </CalCard>
      ) : (
        <CalCard>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  {['Date', 'Event', 'Category', 'Audience', 'Location', 'Status', ''].map((h) => (
                    <th key={h} className="px-2 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                      No events in this academic year yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e: any) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-2 py-2">
                        {fmtCalDate(e.startDate)}
                        {e.endDate !== e.startDate ? ` – ${fmtCalDate(e.endDate)}` : ''}
                      </td>
                      <td className="px-2 py-2 font-medium">
                        {e.title}
                        {e.source !== 'MANUAL' ? (
                          <span className="ml-1 text-[10px] uppercase text-slate-400">
                            {e.source}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs text-white"
                          style={{ background: e.category?.color }}
                        >
                          {e.category?.name}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {(e.audience ?? []).join(', ') || 'Everyone'}
                      </td>
                      <td className="px-2 py-2">{e.location || '—'}</td>
                      <td className="px-2 py-2">{e.status}</td>
                      <td className="px-2 py-2">
                        <GhostButton onClick={() => setDetail(e)}>View</GhostButton>
                        {canManage && e.source === 'MANUAL' ? (
                          <GhostButton onClick={() => openEdit(e)}>Edit</GhostButton>
                        ) : null}
                        {canManage && e.source === 'MANUAL' ? (
                          <GhostButton onClick={() => setConfirmDel(e)}>Delete</GhostButton>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CalCard>
      )}

      <div className="print-calendar mx-auto hidden max-w-[210mm] bg-white p-8 print:block">
        <div className="flex items-start gap-4 border-b pb-4">
          <img src={SCHOOL_SIS_LOGO_SRC} alt="" className="h-16 w-16 object-contain" />
          <div className="flex-1 text-center">
            <h2 className="text-xl font-semibold text-[#1e3a8a]">
              St. Luke&apos;s Higher Secondary School
            </h2>
            <p className="text-xs text-slate-500">Walbakgre, Tura</p>
            <p className="mt-1 font-semibold uppercase tracking-wide">
              Academic Calendar · {setup.data?.year?.name}
            </p>
          </div>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Category</th>
              <th>Classes</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e: any) => (
              <tr key={e.id} className="border-t">
                <td>{fmtCalDate(e.startDate)}</td>
                <td>{e.title}</td>
                <td>{e.category?.name}</td>
                <td>{e.appliesTo || 'All'}</td>
                <td>{e.description || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
          <p className="border-t pt-2">Prepared by</p>
          <p className="border-t pt-2">Principal</p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit event' : 'Add event'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className={`${calField} md:col-span-2`}
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <select
              className={calField}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {(setup.data?.categories ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className={calField}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              />{' '}
              All day
            </label>
            {!form.allDay ? (
              <>
                <input
                  className={calField}
                  placeholder="Start time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
                <input
                  className={calField}
                  placeholder="End time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </>
            ) : null}
            <select
              className={calField}
              value={form.audience[0]}
              onChange={(e) => setForm({ ...form, audience: [e.target.value] })}
            >
              {['EVERYONE', 'STUDENTS', 'PARENTS', 'TEACHING', 'NON_TEACHING', 'CLASSES'].map(
                (a) => (
                  <option key={a}>{a}</option>
                ),
              )}
            </select>
            <input
              className={calField}
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <select
              className={calField}
              value={form.organizerType}
              onChange={(e) => setForm({ ...form, organizerType: e.target.value })}
            >
              <option value="ADMIN">School Administration</option>
              <option value="STAFF">Staff</option>
              <option value="DEPARTMENT">Department</option>
            </select>
            {form.organizerType === 'STAFF' ? (
              <select
                className={calField}
                value={form.organizerStaffId}
                onChange={(e) => setForm({ ...form, organizerStaffId: e.target.value })}
              >
                <option value="">Select staff</option>
                {(staff.data ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            ) : null}
            {form.audience[0] === 'CLASSES' ? (
              <div className="md:col-span-2 flex flex-wrap gap-1">
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
                            ? form.gradeIds.filter((id: string) => id !== g.id)
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
            {isPtm ? (
              <>
                <input
                  className={calField}
                  placeholder="PTM venue"
                  value={form.ptmVenue}
                  onChange={(e) =>
                    setForm({ ...form, ptmVenue: e.target.value, location: e.target.value })
                  }
                />
                <input
                  className={`${calField} md:col-span-2`}
                  placeholder="PTM instructions"
                  value={form.ptmInstructions}
                  onChange={(e) => setForm({ ...form, ptmInstructions: e.target.value })}
                />
              </>
            ) : null}
            <textarea
              className="min-h-[70px] rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {[
              'importantParents',
              'importantStudents',
              'importantTeachers',
              'notifyParents',
              'notifyStudents',
              'notifyTeachers',
            ].map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                />
                {k.replace(/([A-Z])/g, ' $1')}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm md:col-span-2">
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
              disabled={!form.title || !form.startDate || save.isPending}
              onClick={() => save.mutate()}
            >
              Save event
            </PrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete event?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            “{confirmDel?.title}” will be removed from the academic calendar.
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
            <DialogTitle>{detail?.title || detail?.date}</DialogTitle>
          </DialogHeader>
          {detail?.category ? (
            <p className="text-sm">
              {detail.category.name} · {detail.status}
            </p>
          ) : detail?.kind ? (
            <p className="text-sm">{String(detail.kind).replace(/_/g, ' ')}</p>
          ) : null}
          {detail?.startDate ? (
            <p className="text-sm">
              {fmtCalDate(detail.startDate)} {detail.startTime || ''}
            </p>
          ) : null}
          {detail?.location ? <p className="text-sm">Location: {detail.location}</p> : null}
          {detail?.organizer?.fullName ? (
            <p className="text-sm">Organizer: {detail.organizer.fullName}</p>
          ) : null}
          {detail?.description ? (
            <p className="text-sm text-slate-600">{detail.description}</p>
          ) : null}
          {detail?.items?.map((i: any) => (
            <p key={i.id} className="text-sm">
              {i.title} · {i.category?.name}
            </p>
          ))}
        </DialogContent>
      </Dialog>
    </CalendarShell>
  );
}
