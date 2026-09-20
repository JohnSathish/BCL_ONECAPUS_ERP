'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Search,
  Star,
  Umbrella,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import {
  deleteSchoolCalendarEvent,
  fetchSchoolAcademicClasses,
  fetchSchoolCalendarEvents,
  fetchSchoolCalendarSetup,
  fetchSchoolSisStaff,
  saveSchoolAcademicTerms,
  saveSchoolCalendarEvent,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { calField, downloadCsv, fmtCalDate } from './calendar-ui';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import './academic-calendar.css';

const TYPE_GROUPS = [
  {
    id: 'holiday',
    label: 'Holiday',
    kpiLabel: 'Holidays',
    hint: 'School holidays',
    codes: ['HOLIDAY', 'VACATION'],
    color: '#ef4444',
    kpi: 'teal',
    icon: Umbrella,
    quick: 'Add Holiday',
    quickBg: '#ffe4e6',
    quickFg: '#e11d48',
  },
  {
    id: 'exam',
    label: 'Examination',
    kpiLabel: 'Examinations',
    hint: 'Scheduled exams',
    codes: ['EXAMINATION'],
    color: '#8b5cf6',
    kpi: 'purple',
    icon: ClipboardList,
    quick: 'Add Examination',
    quickBg: '#ede9fe',
    quickFg: '#7c3aed',
  },
  {
    id: 'academic',
    label: 'Academic Event',
    kpiLabel: 'Academic Events',
    hint: 'Functions & activities',
    codes: ['ACADEMIC', 'ADMISSION', 'TRAINING'],
    color: '#3b82f6',
    kpi: 'orange',
    icon: Star,
    quick: 'Add Academic Event',
    quickBg: '#dbeafe',
    quickFg: '#2563eb',
  },
  {
    id: 'meeting',
    label: 'Meeting',
    kpiLabel: 'Meetings',
    hint: 'Staff/Parent meetings',
    codes: ['MEETING', 'PTM', 'STAFF', 'ADMIN'],
    color: '#22c55e',
    kpi: 'pink',
    icon: Users,
    quick: 'Add Meeting',
    quickBg: '#ffedd5',
    quickFg: '#ea580c',
  },
  {
    id: 'cocurricular',
    label: 'Co-curricular',
    kpiLabel: 'Co-curricular',
    hint: 'Sports & culture',
    codes: [
      'CO_CURRICULAR',
      'EXTRA',
      'SPORTS',
      'CULTURAL',
      'COMPETITION',
      'SCHOOL_EVENT',
      'STUDENT',
    ],
    color: '#f59e0b',
    kpi: 'blue',
    icon: Star,
    quick: 'Add Co-curricular',
    quickBg: '#dcfce7',
    quickFg: '#16a34a',
  },
  {
    id: 'other',
    label: 'Other',
    kpiLabel: 'Other',
    hint: 'General events',
    codes: ['OTHER'],
    color: '#94a3b8',
    kpi: 'blue',
    icon: CalendarDays,
    quick: 'Add Other Event',
    quickBg: '#f1f5f9',
    quickFg: '#475569',
  },
] as const;

type CalView = 'month' | 'week' | 'list';

function isoUtc(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function groupFor(code?: string | null) {
  const key = code || 'OTHER';
  return TYPE_GROUPS.find((g) => (g.codes as readonly string[]).includes(key)) ?? TYPE_GROUPS[5];
}

function eventOnDate(event: { startDate?: string; endDate?: string }, iso: string) {
  const start = String(event.startDate || '').slice(0, 10);
  const end = String(event.endDate || event.startDate || '').slice(0, 10);
  return start && iso >= start && iso <= end;
}

function prettyTime(event: { allDay?: boolean; startTime?: string | null }) {
  if (event.allDay || !event.startTime) return 'All day';
  return String(event.startTime).slice(0, 5);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AcademicCalendarDesk() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [yearId, setYearId] = useState('');
  const [view, setView] = useState<CalView>('month');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
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
  const [weekAnchor, setWeekAnchor] = useState(todayIso());
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
    queryKey: ['school-cal-events', yearId, status],
    queryFn: () =>
      fetchSchoolCalendarEvents({
        academicYearId: yearId || undefined,
        status: status || undefined,
      }),
    enabled,
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
    const q = search.trim().toLowerCase();
    return (events.data ?? []).filter((e: any) => {
      const group = groupFor(e.category?.code);
      if (typeId && group.id !== typeId) return false;
      if (
        q &&
        !String(e.title || '')
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [events.data, search, typeId]);

  const counts = useMemo(() => {
    const rows = events.data ?? [];
    const byGroup = Object.fromEntries(TYPE_GROUPS.map((g) => [g.id, 0])) as Record<string, number>;
    for (const e of rows) byGroup[groupFor(e.category?.code).id] += 1;
    return byGroup;
  }, [events.data]);

  const today = todayIso();
  const upcoming = useMemo(
    () =>
      filtered
        .filter((e: any) => String(e.endDate || e.startDate || '').slice(0, 10) >= today)
        .slice(0, 6),
    [filtered, today],
  );
  const recent = useMemo(
    () =>
      [...filtered]
        .filter((e: any) => String(e.endDate || e.startDate || '').slice(0, 10) < today)
        .reverse()
        .slice(0, 4),
    [filtered, today],
  );

  const grid = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const prevDays = new Date(Date.UTC(cursor.y, cursor.m - 1, 0)).getUTCDate();
    const cells: Array<{ iso: string; day: number; outside: boolean; items: any[] }> = [];
    for (let i = startPad - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(cursor.y, cursor.m - 2, prevDays - i));
      const iso = isoUtc(d);
      cells.push({
        iso,
        day: d.getUTCDate(),
        outside: true,
        items: filtered.filter((e: any) => eventOnDate(e, iso)),
      });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = isoUtc(new Date(Date.UTC(cursor.y, cursor.m - 1, day)));
      cells.push({
        iso,
        day,
        outside: false,
        items: filtered.filter((e: any) => eventOnDate(e, iso)),
      });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      const d = new Date(`${last.iso}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      const iso = isoUtc(d);
      cells.push({
        iso,
        day: d.getUTCDate(),
        outside: true,
        items: filtered.filter((e: any) => eventOnDate(e, iso)),
      });
    }
    return cells;
  }, [cursor.m, cursor.y, filtered]);

  const weekCells = useMemo(() => {
    const anchor =
      grid.find((c) => c.iso === weekAnchor) ?? grid.find((c) => c.iso === today) ?? grid[0];
    if (!anchor) return [];
    const idx = grid.findIndex((c) => c.iso === anchor.iso);
    const start = idx - (idx % 7);
    return grid.slice(start, start + 7);
  }, [grid, today, weekAnchor]);

  function openEdit(row?: any, categoryCode?: string) {
    const categoryId =
      row?.categoryId ??
      setup.data?.categories?.find((c: any) => c.code === categoryCode)?.id ??
      setup.data?.categories?.[0]?.id ??
      '';
    setEditing(row ?? null);
    setForm({
      title: row?.title ?? '',
      categoryId,
      startDate: row?.startDate?.slice(0, 10) ?? today,
      endDate: row?.endDate?.slice(0, 10) ?? row?.startDate?.slice(0, 10) ?? today,
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

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m - 1 + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });
  }

  function goToday() {
    const n = new Date();
    setCursor({ y: n.getFullYear(), m: n.getMonth() + 1 });
    setWeekAnchor(todayIso());
  }

  function clearFilters() {
    setTypeId('');
    setStatus('');
    setSearch('');
  }

  const monthLabel = new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="sls-cal">
      <div className="sls-cal-head">
        <div className="sls-cal-title">
          <span className="sls-cal-ico">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h1>Academic Calendar</h1>
            <p>
              Plan and manage the academic year&apos;s schedule, examinations, holidays and events.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <nav className="sls-cal-crumb">
            <Link href="/admin">Home</Link>
            <span>›</span>
            <Link href="/admin/school-sis/academic">Calendar</Link>
            <span>›</span>
            <span>Academic Calendar</span>
          </nav>
          {canManage ? (
            <div className="flex items-center gap-2">
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
              <button type="button" className="sls-cal-add" onClick={() => openEdit()}>
                <Plus className="h-4 w-4" /> Add Event
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="sls-cal-error">{error}</p> : null}

      <div className="sls-cal-kpis">
        <article className="sls-cal-kpi is-blue">
          <span className="sls-cal-kpi-ico">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <strong>{filtered.length}</strong>
            <b>Total Events</b>
            <em>This academic year</em>
          </div>
        </article>
        {TYPE_GROUPS.slice(0, 4).map((g) => {
          const Icon = g.icon;
          return (
            <article key={g.id} className={`sls-cal-kpi is-${g.kpi}`}>
              <span className="sls-cal-kpi-ico">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <strong>{counts[g.id] ?? 0}</strong>
                <b>{g.kpiLabel}</b>
                <em>{g.hint}</em>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sls-cal-filters">
        <label>
          Academic Year
          <select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {(setup.data?.years ?? []).map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Event Type
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">All Categories</option>
            {TYPE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED'].map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="sls-cal-search">
          {'\u00a0'}
          <Search className="h-4 w-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
          />
        </label>
        <button type="button" className="sls-cal-clear" onClick={clearFilters}>
          ✕ Clear
        </button>
      </div>

      <div className="sls-cal-layout">
        <aside className="space-y-3">
          <section className="sls-cal-card sls-cal-card-pad">
            <h2>Event Types</h2>
            <div className="sls-cal-types">
              {TYPE_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g.id}
                  className={`sls-cal-type ${typeId === g.id ? 'is-on' : ''}`}
                  onClick={() => setTypeId(typeId === g.id ? '' : g.id)}
                >
                  <i className="sls-cal-dot" style={{ background: g.color }} />
                  {g.label}
                  <span>{counts[g.id] ?? 0}</span>
                </button>
              ))}
            </div>
          </section>
          {canManage ? (
            <section className="sls-cal-card sls-cal-card-pad">
              <h2>Quick Actions</h2>
              <div className="sls-cal-quick">
                {TYPE_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    style={{ background: g.quickBg, color: g.quickFg }}
                    onClick={() => openEdit(undefined, g.codes[0])}
                  >
                    <Plus className="h-4 w-4" /> {g.quick}
                  </button>
                ))}
              </div>
              <details className="sls-cal-terms">
                <summary>Academic terms</summary>
                <p>
                  {setup.data?.year?.name}: {fmtCalDate(setup.data?.year?.startDate)} –{' '}
                  {fmtCalDate(setup.data?.year?.endDate)}
                </p>
                <textarea value={termsText} onChange={(e) => setTermsText(e.target.value)} />
                <GhostButton className="mt-2" onClick={() => saveTerms.mutate()}>
                  Save terms
                </GhostButton>
              </details>
            </section>
          ) : null}
        </aside>

        <section className="sls-cal-card sls-cal-card-pad">
          <div className="sls-cal-month-head">
            <div className="sls-cal-month-nav">
              <button type="button" className="sls-cal-today" onClick={goToday}>
                Today
              </button>
              <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h3>{monthLabel}</h3>
            <div className="sls-cal-views">
              {(['month', 'week', 'list'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={view === v ? 'is-on' : ''}
                  onClick={() => setView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {view === 'month' ? (
            <>
              <div className="sls-cal-weekdays">
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="sls-cal-grid">
                {grid.map((cell) => (
                  <button
                    type="button"
                    key={cell.iso}
                    className={`sls-cal-day ${cell.outside ? 'is-out' : ''} ${cell.iso === today ? 'is-today' : ''}`}
                    onClick={() => {
                      setWeekAnchor(cell.iso);
                      setDetail({ date: cell.iso, items: cell.items, title: fmtCalDate(cell.iso) });
                    }}
                  >
                    <span className="sls-cal-num">{cell.day}</span>
                    {cell.items.slice(0, 3).map((item: any) => {
                      const tone = groupFor(item.category?.code);
                      return (
                        <div key={item.id} className="sls-cal-chip" style={{ color: tone.color }}>
                          <i style={{ background: tone.color }} />
                          <span>{item.title}</span>
                        </div>
                      );
                    })}
                    {cell.items.length > 3 ? (
                      <span className="sls-cal-more">+{cell.items.length - 3} more</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {view === 'week' ? (
            <div className="sls-cal-week">
              {weekCells.map((cell) => (
                <div key={cell.iso} className="sls-cal-week-day">
                  <div>
                    <strong>{fmtCalDate(cell.iso)}</strong>
                    <em>
                      {new Date(`${cell.iso}T00:00:00Z`).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        timeZone: 'UTC',
                      })}
                    </em>
                  </div>
                  <div className="space-y-1">
                    {cell.items.length ? (
                      cell.items.map((item: any) => {
                        const tone = groupFor(item.category?.code);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className="sls-cal-chip"
                            style={{ color: tone.color }}
                            onClick={() => setDetail(item)}
                          >
                            <i style={{ background: tone.color }} />
                            <span>
                              {item.title} · {prettyTime(item)}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="sls-cal-empty">No events</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {view === 'list' ? (
            <div className="overflow-x-auto">
              <table className="sls-cal-list">
                <thead>
                  <tr>
                    {['Date', 'Event', 'Type', 'Status', ''].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="sls-cal-empty">
                        No events in this academic year yet.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e: any) => {
                      const tone = groupFor(e.category?.code);
                      return (
                        <tr key={e.id}>
                          <td>
                            {fmtCalDate(e.startDate)}
                            {e.endDate !== e.startDate ? ` – ${fmtCalDate(e.endDate)}` : ''}
                          </td>
                          <td>
                            <b>{e.title}</b>
                          </td>
                          <td style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</td>
                          <td>{e.status}</td>
                          <td>
                            <GhostButton onClick={() => setDetail(e)}>View</GhostButton>
                            {canManage && e.source === 'MANUAL' ? (
                              <GhostButton onClick={() => openEdit(e)}>Edit</GhostButton>
                            ) : null}
                            {canManage && e.source === 'MANUAL' ? (
                              <GhostButton onClick={() => setConfirmDel(e)}>Delete</GhostButton>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside className="space-y-3">
          <section className="sls-cal-card sls-cal-card-pad">
            <div className="sls-cal-side-head">
              <h2>Upcoming Events</h2>
              <button type="button" onClick={() => setView('list')}>
                View All
              </button>
            </div>
            <div className="sls-cal-side-list">
              {upcoming.length ? (
                upcoming.map((e: any) => {
                  const tone = groupFor(e.category?.code);
                  const d = new Date(`${String(e.startDate).slice(0, 10)}T00:00:00Z`);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="sls-cal-side-item"
                      onClick={() => setDetail(e)}
                    >
                      <span className="sls-cal-side-date" style={{ background: tone.color }}>
                        {d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}
                        <br />
                        {String(d.getUTCDate()).padStart(2, '0')}
                      </span>
                      <span>
                        <b>{e.title}</b>
                        <span>
                          {fmtCalDate(e.startDate)}
                          {e.startTime ? ` · ${prettyTime(e)}` : ''} · {tone.label}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="sls-cal-empty">No upcoming events.</p>
              )}
            </div>
          </section>
          <section className="sls-cal-card sls-cal-card-pad">
            <div className="sls-cal-side-head">
              <h2>Recent Events</h2>
              <button type="button" onClick={() => setView('list')}>
                View All
              </button>
            </div>
            <div className="sls-cal-side-list">
              {recent.length ? (
                recent.map((e: any) => {
                  const tone = groupFor(e.category?.code);
                  const d = new Date(`${String(e.startDate).slice(0, 10)}T00:00:00Z`);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="sls-cal-side-item"
                      onClick={() => setDetail(e)}
                    >
                      <span className="sls-cal-side-date" style={{ background: tone.color }}>
                        {d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })}
                        <br />
                        {String(d.getUTCDate()).padStart(2, '0')}
                      </span>
                      <span>
                        <b>{e.title}</b>
                        <span>
                          {fmtCalDate(e.startDate)} · {tone.label}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="sls-cal-empty">No recent events.</p>
              )}
            </div>
          </section>
        </aside>
      </div>

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
          {canManage && detail?.id && detail?.source === 'MANUAL' ? (
            <DialogFooter>
              <GhostButton onClick={() => openEdit(detail)}>Edit</GhostButton>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
