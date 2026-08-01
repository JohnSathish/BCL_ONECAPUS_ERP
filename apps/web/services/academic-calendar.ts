import { api } from '@/services/api';
import { getDirectApiBaseUrl } from '@/lib/http/env';
import { createHttpClient } from '@/lib/http/create-client';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { pingActivity } from '@/lib/auth/session-activity';

const uploadApi = createHttpClient({
  baseURL: getDirectApiBaseUrl(),
  onSuccess: pingActivity,
  onUnauthorized: (error, retry) => tokenRefreshManager.handle401(error, retry),
});

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

export type AcademicCalendarAttachment = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
};

export type AcademicCalendarEvent = {
  id: string;
  calendarId: string;
  type: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  isWorkingDay: boolean | null;
  createsAttendanceSession: boolean;
  visibility: string;
  publishedToWebsite: boolean;
  active: boolean;
  color?: string | null;
  icon?: string | null;
  venue?: string | null;
  isAllDay?: boolean;
  isRecurring?: boolean;
  recurrenceRule?: string | null;
  programmeId?: string | null;
  semesterId?: string | null;
  shiftId?: string | null;
  departmentIds?: string[];
  visibilityFlags?: {
    students?: boolean;
    staff?: boolean;
    parents?: boolean;
    public?: boolean;
  } | null;
  attachmentUrls?: AcademicCalendarAttachment[];
  organizerName?: string | null;
  createdById?: string | null;
  createdAt?: string;
  updatedAt?: string;
  readOnly?: boolean;
  sourceModule?: string | null;
  occurrenceOf?: string | null;
};

export type ResolvedDay = {
  date: string;
  isWorkingDay: boolean;
  dayKind: string;
  createsAttendanceSession: boolean;
  events: Array<{ id: string; type: string; title: string }>;
};

export type AcademicCalendarMonthSummary = {
  year: number;
  month: number;
  from: string;
  to: string;
  workingDays: number;
  weekends: number;
  holidays: number;
  exams: number;
  meetings: number;
  eventsThisMonth: number;
  todaysEvents: number;
  upcomingEvents: number;
};

export type AcademicCalendarEventTypeRow = {
  type: string;
  label: string;
  defaultColor: string;
  filterGroup: string;
  defaultIsWorkingDay: boolean;
  defaultCreatesAttendanceSession: boolean;
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
  params?: {
    from?: string;
    to?: string;
    type?: string;
    types?: string;
    q?: string;
    departmentId?: string;
    expandRecurrence?: boolean;
  },
) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}/events`, {
    params,
  });
  return data as AcademicCalendarEvent[];
}

export async function fetchAcademicCalendarEvent(eventId: string) {
  const { data } = await api.get(`/v1/academic-calendar/events/${eventId}`);
  return data as AcademicCalendarEvent;
}

export async function fetchMonthSummary(calendarId: string, year: number, month: number) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}/month-summary`, {
    params: { year, month },
  });
  return data as AcademicCalendarMonthSummary;
}

export async function fetchTodayEvents(calendarId: string) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}/today`);
  return data as AcademicCalendarEvent[];
}

export async function fetchUpcomingEvents(calendarId: string, limit = 20) {
  const { data } = await api.get(`/v1/academic-calendar/${calendarId}/upcoming`, {
    params: { limit },
  });
  return data as AcademicCalendarEvent[];
}

export async function createAcademicCalendarEvent(
  calendarId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/events`, payload);
  return data as AcademicCalendarEvent;
}

export async function updateAcademicCalendarEvent(
  eventId: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch(`/v1/academic-calendar/events/${eventId}`, payload);
  return data as AcademicCalendarEvent;
}

export async function deleteAcademicCalendarEvent(eventId: string) {
  const { data } = await api.delete(`/v1/academic-calendar/events/${eventId}`);
  return data;
}

export async function duplicateAcademicCalendarEvent(eventId: string) {
  const { data } = await api.post(`/v1/academic-calendar/events/${eventId}/duplicate`);
  return data as AcademicCalendarEvent;
}

export async function uploadAcademicCalendarAttachment(eventId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await uploadApi.post(
    `/v1/academic-calendar/events/${eventId}/attachments`,
    form,
  );
  return data as AcademicCalendarEvent;
}

export async function bulkAddHolidays(
  calendarId: string,
  items: Array<{ title: string; date: string; type?: string }>,
) {
  const { data } = await api.post(`/v1/academic-calendar/${calendarId}/holidays/bulk`, { items });
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
  return data as AcademicCalendarEventTypeRow[];
}
