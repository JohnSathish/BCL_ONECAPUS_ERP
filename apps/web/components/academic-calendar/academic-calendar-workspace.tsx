'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreHorizontal,
  Plus,
  Upload,
} from 'lucide-react';

import { CalendarBottomPanels } from '@/components/academic-calendar/calendar-bottom-panels';
import { CalendarEventChip } from '@/components/academic-calendar/calendar-event-chip';
import { CalendarMonthGrid } from '@/components/academic-calendar/calendar-month-grid';
import { CalendarSidebar } from '@/components/academic-calendar/calendar-sidebar';
import {
  CalendarStatsRow,
  type StatCardKey,
} from '@/components/academic-calendar/calendar-stats-row';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import {
  createAcademicCalendarEvent,
  deleteAcademicCalendarEvent,
  duplicateAcademicCalendarEvent,
  ensureAcademicCalendar,
  fetchAcademicCalendarEventTypes,
  fetchAcademicCalendarEvents,
  fetchAcademicCalendarYears,
  fetchMonthSummary,
  fetchTodayEvents,
  fetchUpcomingEvents,
  importStaffHolidays,
  publishAcademicCalendar,
  resolveAcademicCalendarRange,
  unpublishAcademicCalendar,
  updateAcademicCalendarEvent,
  uploadAcademicCalendarAttachment,
  type AcademicCalendarEvent,
} from '@/services/academic-calendar';
import { apiErrorMessage } from '@/utils/api-error';
import {
  addDaysIso,
  DEFAULT_CALENDAR_FILTERS,
  filterGroupForType,
  formatDisplayDate,
  monthBounds,
  startOfWeekSunday,
  type CalendarFilterKey,
  type CalendarViewMode,
} from '@/lib/academic-calendar-ui';
import {
  AcademicCalendarEventFormDialog,
  formValuesToPayload,
  type EventFormValues,
} from './event-form-dialog';
import { AcademicCalendarEventDetailsDialog } from './event-details-dialog';
import { cn } from '@/utils/cn';

function todayUtcIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AcademicCalendarWorkspace() {
  const session = useRequireAuth();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canEdit = permissions.some((p) =>
    ['academic-calendar:edit', 'academic-calendar:manage'].includes(p),
  );
  const canManage = permissions.includes('academic-calendar:manage');
  const qc = useQueryClient();
  const now = new Date();

  const [academicYearId, setAcademicYearId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDay, setSelectedDay] = useState(todayUtcIso());
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(DEFAULT_CALENDAR_FILTERS);
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formDate, setFormDate] = useState<string | undefined>();
  const [editing, setEditing] = useState<AcademicCalendarEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AcademicCalendarEvent | null>(null);
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    date: string;
    event?: AcademicCalendarEvent;
  } | null>(null);

  const years = useQuery({
    queryKey: ['academic-calendar', 'years'],
    queryFn: () => fetchAcademicCalendarYears(),
    enabled: Boolean(session),
  });

  const eventTypes = useQuery({
    queryKey: ['academic-calendar', 'event-types'],
    queryFn: fetchAcademicCalendarEventTypes,
    enabled: Boolean(session),
  });

  const { from, to, last } = monthBounds(viewYear, viewMonth);
  const weekStart = startOfWeekSunday(selectedDay);
  const weekEnd = addDaysIso(weekStart, 6);
  const rangeFrom = viewMode === 'month' ? from : viewMode === 'week' ? weekStart : selectedDay;
  const rangeTo = viewMode === 'month' ? to : viewMode === 'week' ? weekEnd : selectedDay;
  const todayIso = todayUtcIso();

  const monthGrid = useQuery({
    queryKey: ['academic-calendar', 'range', calendarId, from, to],
    queryFn: () => resolveAcademicCalendarRange({ from, to, calendarId, academicYearId }),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const eventsQuery = useQuery({
    queryKey: ['academic-calendar', 'events', calendarId, rangeFrom, rangeTo, search],
    queryFn: () =>
      fetchAcademicCalendarEvents(calendarId, {
        from: rangeFrom,
        to: rangeTo,
        q: search || undefined,
        expandRecurrence: true,
      }),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const summary = useQuery({
    queryKey: ['academic-calendar', 'summary', calendarId, viewYear, viewMonth],
    queryFn: () => fetchMonthSummary(calendarId, viewYear, viewMonth),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const todayQuery = useQuery({
    queryKey: ['academic-calendar', 'today', calendarId],
    queryFn: () => fetchTodayEvents(calendarId),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const upcomingQuery = useQuery({
    queryKey: ['academic-calendar', 'upcoming', calendarId],
    queryFn: () => fetchUpcomingEvents(calendarId, 8),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const filteredEvents = useMemo(() => {
    const list = eventsQuery.data ?? [];
    return list.filter((e) => filters[filterGroupForType(e.type)]);
  }, [eventsQuery.data, filters]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AcademicCalendarEvent[]>();
    for (const ev of filteredEvents) {
      let cursor = ev.startDate;
      while (cursor <= ev.endDate) {
        const arr = map.get(cursor) ?? [];
        arr.push(ev);
        map.set(cursor, arr);
        cursor = addDaysIso(cursor, 1);
        if (cursor > addDaysIso(ev.startDate, 60)) break;
      }
    }
    return map;
  }, [filteredEvents]);

  const filterCounts = useMemo(() => {
    const counts: Partial<Record<CalendarFilterKey, number>> = {};
    for (const ev of eventsQuery.data ?? []) {
      const group = filterGroupForType(ev.type);
      counts[group] = (counts[group] ?? 0) + 1;
    }
    return counts;
  }, [eventsQuery.data]);

  const dayMap = useMemo(() => {
    const m = new Map<string, { date: string; dayKind?: string }>();
    for (const d of monthGrid.data ?? []) {
      m.set(d.date, { date: d.date, dayKind: d.dayKind });
    }
    return m;
  }, [monthGrid.data]);

  const leadingBlanks = useMemo(() => {
    const first = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
    return first.getUTCDay();
  }, [viewYear, viewMonth]);

  const eventDates = useMemo(() => new Set(Array.from(eventsByDate.keys())), [eventsByDate]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
  }, [qc]);

  const ensureMut = useMutation({
    mutationFn: () => ensureAcademicCalendar({ academicYearId }),
    onSuccess: (cal) => {
      setCalendarId(cal.id);
      setMessage(`Calendar ready (${cal.status})`);
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const saveMut = useMutation({
    mutationFn: async (input: { values: EventFormValues; addAnother: boolean }) => {
      const payload = formValuesToPayload(input.values);
      if (editing) {
        const id = editing.occurrenceOf ?? editing.id;
        return updateAcademicCalendarEvent(id, payload);
      }
      return createAcademicCalendarEvent(calendarId, payload);
    },
    onSuccess: (_data, vars) => {
      setMessage(editing ? 'Event updated' : 'Event created');
      invalidate();
      if (!vars.addAnother) {
        setFormOpen(false);
        setEditing(null);
      }
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAcademicCalendarEvent(id),
    onSuccess: () => {
      setMessage('Event deleted');
      setDetailsOpen(false);
      setSelectedEvent(null);
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
  });

  useEffect(() => {
    if (!years.data?.length || academicYearId) return;
    const first = years.data[0];
    setAcademicYearId(first.id);
    if (first.calendar?.id) setCalendarId(first.calendar.id);
  }, [years.data, academicYearId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!calendarId || !canEdit) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditing(null);
        setFormDate(selectedDay);
        setFormOpen(true);
      }
      if ((e.key === 'e' || e.key === 'E') && selectedEvent && detailsOpen) {
        e.preventDefault();
        if (!selectedEvent.readOnly) {
          setEditing(selectedEvent);
          setFormOpen(true);
        }
      }
      if (e.key === 'Delete' && selectedEvent && detailsOpen && !selectedEvent.readOnly) {
        e.preventDefault();
        if (confirm('Delete this event?')) {
          deleteMut.mutate(selectedEvent.occurrenceOf ?? selectedEvent.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [calendarId, canEdit, selectedDay, selectedEvent, detailsOpen, deleteMut]);

  useEffect(() => {
    const close = () => {
      setCtxMenu(null);
      setMenuOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const openAdd = (date: string) => {
    if (!canEdit) return;
    setEditing(null);
    setFormDate(date);
    setFormOpen(true);
  };

  const openEvent = (ev: AcademicCalendarEvent) => {
    setSelectedEvent(ev);
    setDetailsOpen(true);
  };

  const selectedYear = years.data?.find((y) => y.id === academicYearId);
  const monthLabel = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const goPrev = () => {
    if (viewMode === 'month') {
      const d = new Date(Date.UTC(viewYear, viewMonth - 2, 1));
      setViewYear(d.getUTCFullYear());
      setViewMonth(d.getUTCMonth() + 1);
    } else {
      setSelectedDay(addDaysIso(selectedDay, viewMode === 'week' ? -7 : -1));
    }
  };

  const goNext = () => {
    if (viewMode === 'month') {
      const d = new Date(Date.UTC(viewYear, viewMonth, 1));
      setViewYear(d.getUTCFullYear());
      setViewMonth(d.getUTCMonth() + 1);
    } else {
      setSelectedDay(addDaysIso(selectedDay, viewMode === 'week' ? 7 : 1));
    }
  };

  const goToday = () => {
    const t = todayUtcIso();
    setSelectedDay(t);
    setViewYear(Number(t.slice(0, 4)));
    setViewMonth(Number(t.slice(5, 7)));
  };

  const onStatSelect = (key: StatCardKey) => {
    if (key === 'todaysEvents') {
      setViewMode('day');
      setSelectedDay(todayIso);
      return;
    }
    if (key === 'upcomingEvents') {
      setViewMode('agenda');
      return;
    }
    setViewMode('month');
  };

  const todayEvents = useMemo(() => {
    const fromApi = todayQuery.data ?? [];
    if (fromApi.length) return fromApi;
    return eventsByDate.get(todayIso) ?? [];
  }, [todayQuery.data, eventsByDate, todayIso]);

  const upcomingEvents = useMemo(() => {
    const fromApi = upcomingQuery.data ?? [];
    if (fromApi.length) return fromApi.slice(0, 6);
    const end = addDaysIso(todayIso, 7);
    return filteredEvents.filter((e) => e.startDate >= todayIso && e.startDate <= end).slice(0, 6);
  }, [upcomingQuery.data, filteredEvents, todayIso]);

  return (
    <div
      className="space-y-4 rounded-3xl bg-[#F8FAFC] p-1 sm:p-2"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sticky module header */}
      <header className="sticky top-0 z-20 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">
                Academic Calendar
              </h1>
              <p className="truncate text-xs text-slate-500">
                {selectedYear?.calendar?.title ??
                  selectedYear?.name ??
                  'Institutional working days, holidays & events'}
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              className="h-10 min-w-[180px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm shadow-sm"
              value={academicYearId}
              onChange={(e) => {
                const id = e.target.value;
                setAcademicYearId(id);
                const y = years.data?.find((x) => x.id === id);
                setCalendarId(y?.calendar?.id ?? '');
              }}
              aria-label="Academic year"
            >
              <option value="">Select year</option>
              {(years.data ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.calendar ? ` · ${y.calendar.status}` : ' · no calendar'}
                </option>
              ))}
            </select>

            {academicYearId && !calendarId ? (
              <Button
                className="rounded-xl"
                onClick={() => ensureMut.mutate()}
                disabled={ensureMut.isPending}
              >
                Create / Open Calendar
              </Button>
            ) : null}

            {calendarId && canManage ? (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() =>
                    publishAcademicCalendar(calendarId)
                      .then(() => {
                        setMessage('Published');
                        invalidate();
                      })
                      .catch((e) => setMessage(apiErrorMessage(e)))
                  }
                >
                  Publish
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    unpublishAcademicCalendar(calendarId)
                      .then(() => {
                        setMessage('Unpublished');
                        invalidate();
                      })
                      .catch((e) => setMessage(apiErrorMessage(e)))
                  }
                >
                  Unpublish
                </Button>
              </>
            ) : null}

            {calendarId && canEdit ? (
              <Button
                variant="outline"
                className="rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50"
                onClick={() =>
                  importStaffHolidays(calendarId)
                    .then((r) => {
                      setMessage(`Imported ${r.imported}, skipped ${r.skipped}`);
                      invalidate();
                    })
                    .catch((e) => setMessage(apiErrorMessage(e)))
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Holidays
              </Button>
            ) : null}

            {calendarId && canEdit ? (
              <Button
                className="rounded-xl bg-[#2563EB] hover:bg-sky-700"
                onClick={() => {
                  setEditing(null);
                  setFormDate(selectedDay);
                  setFormOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New Event (N)
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {message ? (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
          >
            {message}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {!calendarId ? (
        <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center shadow-sm">
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-semibold text-slate-800">No events scheduled.</p>
          <p className="mt-1 text-sm text-slate-500">
            Select an academic year and create or open its calendar to begin.
          </p>
          {academicYearId ? (
            <Button
              className="mt-4 rounded-xl"
              onClick={() => ensureMut.mutate()}
              disabled={ensureMut.isPending}
            >
              Create Event Calendar
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <CalendarStatsRow
            values={{
              workingDays: summary.data?.workingDays ?? '—',
              weekends: summary.data?.weekends ?? '—',
              holidays: summary.data?.holidays ?? '—',
              exams: summary.data?.exams ?? '—',
              meetings: summary.data?.meetings ?? '—',
              eventsThisMonth: summary.data?.eventsThisMonth ?? '—',
              todaysEvents: summary.data?.todaysEvents ?? '—',
              upcomingEvents: summary.data?.upcomingEvents ?? '—',
            }}
            onSelect={onStatSelect}
          />

          <div className="flex flex-col gap-4 lg:flex-row">
            <CalendarSidebar
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              filterCounts={filterCounts}
              onToggleFilter={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              canEdit={canEdit}
              onAddEvent={() => openAdd(selectedDay)}
              onImportHolidays={() =>
                importStaffHolidays(calendarId)
                  .then((r) => {
                    setMessage(`Imported ${r.imported}, skipped ${r.skipped}`);
                    invalidate();
                  })
                  .catch((e) => setMessage(apiErrorMessage(e)))
              }
              mobileOpen={sidebarOpen}
              onCloseMobile={() => setSidebarOpen(false)}
            />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2.5 shadow-sm">
                <div className="flex rounded-xl bg-[#F8FAFC] p-1">
                  {(['month', 'week', 'day', 'agenda'] as CalendarViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm capitalize transition',
                        viewMode === mode
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white',
                      )}
                      onClick={() => setViewMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={goPrev}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={goNext}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={goToday}>
                    Today
                  </Button>
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  {viewMode === 'month' ? monthLabel : formatDisplayDate(selectedDay)}
                </p>

                <div className="relative ml-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen((v) => !v);
                    }}
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {menuOpen ? (
                    <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[#E5E7EB] bg-white py-1 text-sm shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => window.print()}
                      >
                        Print
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        onClick={goToday}
                      >
                        Jump to today
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {viewMode === 'month' ? (
                <CalendarMonthGrid
                  viewYear={viewYear}
                  viewMonth={viewMonth}
                  lastDay={last}
                  leadingBlanks={leadingBlanks}
                  todayIso={todayIso}
                  selectedDay={selectedDay}
                  dayMap={dayMap}
                  eventsByDate={eventsByDate}
                  onSelectDay={setSelectedDay}
                  onAddDay={openAdd}
                  onOpenEvent={openEvent}
                  onMore={setDayListDate}
                  onContextMenu={setCtxMenu}
                />
              ) : null}

              {viewMode === 'week' || viewMode === 'day' ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                  <div
                    className={cn(
                      'grid gap-3',
                      viewMode === 'week' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-1',
                    )}
                  >
                    {Array.from({
                      length: viewMode === 'week' ? 7 : 1,
                    }).map((_, i) => {
                      const iso = viewMode === 'week' ? addDaysIso(weekStart, i) : selectedDay;
                      const dayEvents = eventsByDate.get(iso) ?? [];
                      return (
                        <div
                          key={iso}
                          className={cn(
                            'min-h-[220px] rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-2.5',
                            iso === todayIso && 'ring-2 ring-sky-400/60',
                          )}
                          onDoubleClick={() => openAdd(iso)}
                          onClick={() => setSelectedDay(iso)}
                        >
                          <p className="mb-2 text-xs font-semibold text-slate-700">
                            {formatDisplayDate(iso)}
                          </p>
                          <div className="space-y-1.5">
                            {dayEvents.map((ev) => (
                              <CalendarEventChip key={ev.id} event={ev} onClick={openEvent} />
                            ))}
                            {!dayEvents.length ? (
                              <p className="text-xs text-slate-400">No events</p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {viewMode === 'agenda' ? (
                <div className="space-y-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
                  {filteredEvents.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <p className="text-sm text-slate-500">No events in range.</p>
                      {canEdit ? (
                        <Button className="mt-3 rounded-xl" onClick={() => openAdd(selectedDay)}>
                          Create Event
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    filteredEvents.map((ev) => (
                      <CalendarEventChip key={ev.id} event={ev} onClick={openEvent} />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <CalendarBottomPanels
            todayIso={todayIso}
            todayEvents={todayEvents}
            upcomingEvents={upcomingEvents}
            viewYear={viewYear}
            viewMonth={viewMonth}
            eventDates={eventDates}
            selectedDay={selectedDay}
            onSelectDay={(iso) => {
              setSelectedDay(iso);
              setViewMode('day');
            }}
            onOpenEvent={openEvent}
            onCreateEvent={canEdit ? () => openAdd(todayIso) : undefined}
          />
        </>
      )}

      {canEdit && calendarId ? (
        <Button
          className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full bg-[#2563EB] shadow-lg lg:hidden"
          size="icon"
          onClick={() => openAdd(selectedDay)}
          aria-label="New event"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : null}

      {dayListDate ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{formatDisplayDate(dayListDate)}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => setDayListDate(null)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-2">
              {(eventsByDate.get(dayListDate) ?? []).map((ev) => (
                <CalendarEventChip
                  key={ev.id}
                  event={ev}
                  onClick={(event) => {
                    setDayListDate(null);
                    openEvent(event);
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      ) : null}

      {ctxMenu ? (
        <div
          className="fixed z-50 min-w-[170px] rounded-xl border border-[#E5E7EB] bg-white py-1 text-sm shadow-xl"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {canEdit ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => openAdd(ctxMenu.date)}
            >
              Add Event
            </button>
          ) : null}
          {ctxMenu.event ? (
            <>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => openEvent(ctxMenu.event!)}
              >
                Open
              </button>
              {canEdit && !ctxMenu.event.readOnly ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() =>
                    duplicateAcademicCalendarEvent(ctxMenu.event!.occurrenceOf ?? ctxMenu.event!.id)
                      .then(() => {
                        setMessage('Duplicated');
                        invalidate();
                      })
                      .catch((e) => setMessage(apiErrorMessage(e)))
                  }
                >
                  Duplicate
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <AcademicCalendarEventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        eventTypes={eventTypes.data ?? []}
        initialDate={formDate}
        editing={editing}
        saving={saveMut.isPending}
        onSubmit={async (values, addAnother) => {
          await saveMut.mutateAsync({ values, addAnother });
        }}
      />

      <AcademicCalendarEventDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        event={selectedEvent}
        canEdit={canEdit}
        onEdit={() => {
          if (!selectedEvent) return;
          setEditing(selectedEvent);
          setFormOpen(true);
        }}
        onDelete={() => {
          if (!selectedEvent) return;
          if (confirm('Delete this event?')) {
            deleteMut.mutate(selectedEvent.occurrenceOf ?? selectedEvent.id);
          }
        }}
        onDuplicate={() => {
          if (!selectedEvent) return;
          duplicateAcademicCalendarEvent(selectedEvent.occurrenceOf ?? selectedEvent.id)
            .then(() => {
              setMessage('Duplicated');
              invalidate();
            })
            .catch((e) => setMessage(apiErrorMessage(e)));
        }}
        onUpload={(file) => {
          if (!selectedEvent) return;
          uploadAcademicCalendarAttachment(selectedEvent.occurrenceOf ?? selectedEvent.id, file)
            .then((ev) => {
              setSelectedEvent(ev);
              setMessage('Attachment uploaded');
              invalidate();
            })
            .catch((e) => setMessage(apiErrorMessage(e)));
        }}
      />
    </div>
  );
}
