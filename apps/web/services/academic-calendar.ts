import { api } from '@/services/api';

export type AcademicCalendarYearRow = {
  id: string;
  name: string;
  institutionId: string;
  startDate: string;
  endDate: string;
  calendar: {
    id: string;
    title: string;
    status: string;
    weekendDays: number[];
    publishedAt: string | null;
    eventCount: number;
  } | null;
};

export type AcademicCalendarDetail = {
  id: string;
  title: string;
  status: string;
  weekendDays: number[];
  publishedAt: string | null;
  institutionId: string;
  academicYearId: string;
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    institutionId: string;
  };
  eventCount: number;
};

export type AcademicCalendarEvent = {
  id: string;
  calendarId: string;
  type: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isWorkingDay: boolean | null;
  createsAttendanceSession: boolean;
  visibility: string;
  publishedToWebsite: boolean;
  active: boolean;
};

export type ResolvedDay = {
  date: string;
  isWorkingDay: boolean;
  dayKind: string;
  createsAttendanceSession: boolean;
  events: Array<{ id: string; type: string; title: string }>;
};

export async function fetchAcademicCalendarYears(institutionId?: string) {
  const { data } = await api.get('/v1/academic-calendar/years', {
    params: institutionId ? { institutionId } : undefined,
  });
  return data as AcademicCalendarYearRow[];
}

export async function ensureAcademicCalendar(payload: {
  academicYearId: string;
  title?: string;
  weekendDays?: number[];
}) {
  const { data } = await api.post('/v1/academic-calendar/ensure', payload);
  return data as AcademicCalendarDetail;
}

export async function fetchAcademicCalendar(calendarId: string) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}`);
  return data as AcademicCalendarDetail;
}

export async function updateAcademicCalendar(
  calendarId: string,
  payload: { title?: string; weekendDays?: number[] },
) {
  const { data } = await api.patch(`/v1/academic-calendar/${calendarId}`, payload);
  return data as AcademicCalendarDetail;
}

export async function publishAcademicCalendar(calendarId: string) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/publish`);
  return data as AcademicCalendarDetail;
}

export async function unpublishAcademicCalendar(calendarId: string) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/unpublish`);
  return data as AcademicCalendarDetail;
}

export async function fetchAcademicCalendarEvents(
  calendarId: string,
  params?: { from?: string; to?: string; type?: string },
) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}/events`, { params });
  return data as AcademicCalendarEvent[];
}

export async function createAcademicCalendarEvent(
  calendarId: string,
  payload: Partial<AcademicCalendarEvent> & {
    type: string;
    title: string;
    startDate: string;
  },
) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/events`, payload);
  return data as AcademicCalendarEvent;
}

export async function updateAcademicCalendarEvent(
  eventId: string,
  payload: Partial<AcademicCalendarEvent>,
) {
  const { data } = await api.patch(`/v1/academic-calendar/events/${eventId}`, payload);
  return data as AcademicCalendarEvent;
}

export async function deleteAcademicCalendarEvent(eventId: string) {
  const { data } = await api.delete(`/v1/academic-calendar/events/${eventId}`);
  return data;
}

export async function bulkAddHolidays(
  calendarId: string,
  items: Array<{ title: string; date: string; type?: string }>,
) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/holidays/bulk`, {
    items,
  });
  return data as { created: number; events: AcademicCalendarEvent[] };
}

export async function importStaffHolidays(calendarId: string) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/import-staff-holidays`);
  return data as { imported: number; skipped: number; total: number };
}

export async function resolveAcademicCalendarRange(params: {
  from: string;
  to: string;
  calendarId?: string;
  academicYearId?: string;
}) {
  const { data } = await api.get('/v1/academic-calendar/range', { params });
  return data as ResolvedDay[];
}

export async function fetchAcademicCalendarEventTypes() {
  const { data } = await api.get('/v1/academic-calendar/event-types');
  return data as Array<{
    type: string;
    defaultIsWorkingDay: boolean;
    defaultCreatesAttendanceSession: boolean;
  }>;
}
