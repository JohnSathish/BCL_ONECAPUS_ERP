'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  bulkAddHolidays,
  createAcademicCalendarEvent,
  deleteAcademicCalendarEvent,
  ensureAcademicCalendar,
  fetchAcademicCalendarEventTypes,
  fetchAcademicCalendarEvents,
  fetchAcademicCalendarYears,
  importStaffHolidays,
  publishAcademicCalendar,
  resolveAcademicCalendarRange,
  unpublishAcademicCalendar,
  updateAcademicCalendarEvent,
} from '@/services/academic-calendar';
import { apiErrorMessage } from '@/utils/api-error';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

export default function AcademicCalendarAdminPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [academicYearId, setAcademicYearId] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [message, setMessage] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayType, setHolidayType] = useState('COLLEGE_HOLIDAY');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState('INSTITUTIONAL_EVENT');
  const [eventDate, setEventDate] = useState('');
  const [eventVisibility, setEventVisibility] = useState('PUBLIC');
  const [publishToWebsite, setPublishToWebsite] = useState(true);

  const years = useQuery({
    queryKey: ['academic-calendar', 'years'],
    queryFn: () => fetchAcademicCalendarYears(),
    enabled: Boolean(session),
  });

  const selectedYear = useMemo(
    () => years.data?.find((y) => y.id === academicYearId) ?? null,
    [years.data, academicYearId],
  );

  const eventTypes = useQuery({
    queryKey: ['academic-calendar', 'event-types'],
    queryFn: fetchAcademicCalendarEventTypes,
    enabled: Boolean(session),
  });

  const events = useQuery({
    queryKey: ['academic-calendar', 'events', calendarId],
    queryFn: () => fetchAcademicCalendarEvents(calendarId),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const { from, to } = monthBounds(viewYear, viewMonth);
  const monthGrid = useQuery({
    queryKey: ['academic-calendar', 'range', calendarId, from, to],
    queryFn: () => resolveAcademicCalendarRange({ from, to, calendarId, academicYearId }),
    enabled: Boolean(session) && Boolean(calendarId),
  });

  const ensureMut = useMutation({
    mutationFn: () => ensureAcademicCalendar({ academicYearId }),
    onSuccess: (cal) => {
      setCalendarId(cal.id);
      setMessage(`Calendar ready (${cal.status})`);
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const publishMut = useMutation({
    mutationFn: () => publishAcademicCalendar(calendarId),
    onSuccess: () => {
      setMessage('Calendar published');
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const unpublishMut = useMutation({
    mutationFn: () => unpublishAcademicCalendar(calendarId),
    onSuccess: () => {
      setMessage('Calendar set to draft');
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const importMut = useMutation({
    mutationFn: () => importStaffHolidays(calendarId),
    onSuccess: (res) => {
      setMessage(
        `Imported ${res.imported} staff holidays (${res.skipped} skipped of ${res.total})`,
      );
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const addHolidayMut = useMutation({
    mutationFn: () =>
      bulkAddHolidays(calendarId, [{ title: holidayTitle, date: holidayDate, type: holidayType }]),
    onSuccess: () => {
      setHolidayTitle('');
      setHolidayDate('');
      setMessage('Holiday added');
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const addEventMut = useMutation({
    mutationFn: () =>
      createAcademicCalendarEvent(calendarId, {
        type: eventType,
        title: eventTitle,
        startDate: eventDate,
        endDate: eventDate,
        visibility: eventVisibility,
        publishedToWebsite: publishToWebsite,
      }),
    onSuccess: () => {
      setEventTitle('');
      setEventDate('');
      setMessage('Event added');
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const toggleWebsiteMut = useMutation({
    mutationFn: (payload: { id: string; publishedToWebsite: boolean }) =>
      updateAcademicCalendarEvent(payload.id, {
        publishedToWebsite: payload.publishedToWebsite,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['academic-calendar'] }),
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAcademicCalendarEvent(id),
    onSuccess: () => {
      setMessage('Event removed');
      void qc.invalidateQueries({ queryKey: ['academic-calendar'] });
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  if (!session) return null;

  const calendarStatus = selectedYear?.calendar?.status ?? '—';

  return (
    <DashboardShell role="admin" title="Academic Calendar">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Foundation calendar</CardTitle>
            <CardDescription>
              One calendar per academic year. Working Day Engine answers holidays and holiday-class
              days for Attendance, Timetable, and the college website handbook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Academic year</Label>
                <select
                  className={selectClass}
                  value={academicYearId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAcademicYearId(id);
                    const year = years.data?.find((y) => y.id === id);
                    setCalendarId(year?.calendar?.id ?? '');
                    if (year?.startDate) {
                      const [y, m] = year.startDate.split('-').map(Number);
                      setViewYear(y);
                      setViewMonth(m);
                    }
                  }}
                >
                  <option value="">Select year…</option>
                  {(years.data ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                      {y.calendar ? ` (${y.calendar.status})` : ' — no calendar'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <p className="flex h-10 items-center text-sm font-medium">{calendarStatus}</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  disabled={!academicYearId || ensureMut.isPending}
                  onClick={() => ensureMut.mutate()}
                >
                  {calendarId ? 'Open / refresh' : 'Create calendar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!calendarId || publishMut.isPending}
                  onClick={() => publishMut.mutate()}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!calendarId || unpublishMut.isPending}
                  onClick={() => unpublishMut.mutate()}
                >
                  Unpublish
                </Button>
              </div>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <p className="text-xs text-muted-foreground">
              Staff Attendance public holidays now redirect here.{' '}
              <Link className="underline" href="/admin/staff/attendance/public-holidays">
                Legacy path
              </Link>
            </p>
          </CardContent>
        </Card>

        {calendarId ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Month grid</CardTitle>
                <CardDescription>
                  Working-day resolution for {from} → {to}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={viewYear}
                      onChange={(e) => setViewYear(Number(e.target.value) || viewYear)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <select
                      className={selectClass}
                      value={viewMonth}
                      onChange={(e) => setViewMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="font-medium text-muted-foreground">
                      {d}
                    </div>
                  ))}
                  {(() => {
                    const firstDow = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
                    const cells: Array<ReactElement | null> = [];
                    for (let i = 0; i < firstDow; i += 1) {
                      cells.push(<div key={`pad-${i}`} />);
                    }
                    for (const day of monthGrid.data ?? []) {
                      const tone = day.createsAttendanceSession
                        ? 'bg-amber-100 border-amber-300'
                        : day.isWorkingDay
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-rose-50 border-rose-200';
                      cells.push(
                        <div
                          key={day.date}
                          className={`min-h-16 rounded border p-1 text-left ${tone}`}
                          title={day.events.map((e) => e.title).join(', ') || day.dayKind}
                        >
                          <div className="font-semibold">{Number(day.date.slice(8, 10))}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {day.dayKind}
                          </div>
                          {day.events[0] ? (
                            <div className="truncate text-[10px]">{day.events[0].title}</div>
                          ) : null}
                        </div>,
                      );
                    }
                    return cells;
                  })()}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Add holiday</CardTitle>
                  <CardDescription>Bulk-friendly holiday entry for this year.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Holiday name"
                    value={holidayTitle}
                    onChange={(e) => setHolidayTitle(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={holidayDate}
                    onChange={(e) => setHolidayDate(e.target.value)}
                  />
                  <select
                    className={selectClass}
                    value={holidayType}
                    onChange={(e) => setHolidayType(e.target.value)}
                  >
                    {(eventTypes.data ?? [])
                      .filter((t) => t.type.includes('HOLIDAY') || t.type.includes('CLOSURE'))
                      .map((t) => (
                        <option key={t.type} value={t.type}>
                          {t.type}
                        </option>
                      ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={!holidayTitle.trim() || !holidayDate || addHolidayMut.isPending}
                      onClick={() => addHolidayMut.mutate()}
                    >
                      Add holiday
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={importMut.isPending}
                      onClick={() => importMut.mutate()}
                    >
                      Import StaffPublicHoliday
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Add event</CardTitle>
                  <CardDescription>
                    Exams, orientation, compensatory class, and other typed events.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Event title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                  <select
                    className={selectClass}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  >
                    {(eventTypes.data ?? []).map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClass}
                    value={eventVisibility}
                    onChange={(e) => setEventVisibility(e.target.value)}
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="INTERNAL">INTERNAL</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={publishToWebsite}
                      onChange={(e) => setPublishToWebsite(e.target.checked)}
                    />
                    Publish to website
                  </label>
                  <Button
                    type="button"
                    disabled={!eventTitle.trim() || !eventDate || addEventMut.isPending}
                    onClick={() => addEventMut.mutate()}
                  >
                    Add event
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Events</CardTitle>
                <CardDescription>
                  {events.data?.length ?? 0} event(s) on this calendar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Title</th>
                        <th className="py-2 pr-3">Website</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(events.data ?? []).map((ev) => (
                        <tr key={ev.id} className="border-b border-border/60">
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {ev.startDate}
                            {ev.endDate !== ev.startDate ? ` → ${ev.endDate}` : ''}
                          </td>
                          <td className="py-2 pr-3">{ev.type}</td>
                          <td className="py-2 pr-3">{ev.title}</td>
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() =>
                                toggleWebsiteMut.mutate({
                                  id: ev.id,
                                  publishedToWebsite: !ev.publishedToWebsite,
                                })
                              }
                            >
                              {ev.publishedToWebsite ? 'Yes' : 'No'}
                            </button>
                          </td>
                          <td className="py-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMut.mutate(ev.id)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
