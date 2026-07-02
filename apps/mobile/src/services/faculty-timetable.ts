import { apiFetch } from '@/api/client';

export type TimetableDay = { value: number; label: string };

export type FacultyTimetableEntry = {
  id: string;
  dayOfWeek: number;
  periodNo?: number | null;
  startTime: string;
  endTime: string;
  course?: { code: string; title: string } | null;
  teachingSubjectGroup?: { code: string; title: string } | null;
  classroom?: { code: string; name: string } | null;
  sectionCode?: string | null;
  semesterSequence?: number | null;
  shiftName?: string | null;
  slotType?: string;
};

export type FacultyTimetableRow = {
  id: string;
  dayOfWeek: number;
  periodNo?: number | null;
  label: string;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
  isLunch?: boolean;
  entries: FacultyTimetableEntry[];
};

export type FacultyWeekTimetable = {
  plan?: { id: string; name: string; status: string };
  days: TimetableDay[];
  rows: FacultyTimetableRow[];
  mergedShifts?: boolean;
};

export function fetchFacultyWeekTimetable(params?: { shiftId?: string; streamId?: string }) {
  const search = new URLSearchParams();
  if (params?.shiftId) search.set('shiftId', params.shiftId);
  if (params?.streamId) search.set('streamId', params.streamId);
  const query = search.toString();
  return apiFetch<FacultyWeekTimetable>(
    `/v1/timetable/views/faculty/week${query ? `?${query}` : ''}`,
  );
}

export function formatTimetableTime(value: string) {
  if (!value) return '—';
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${minute} ${period}`;
}

export function groupTimetableByDay(timetable: FacultyWeekTimetable) {
  const dayOrder = timetable.days?.length
    ? timetable.days
    : [
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' },
      ];

  const grouped = new Map<number, { label: string; slots: FacultyTimetableSlot[] }>();
  for (const day of dayOrder) {
    grouped.set(day.value, { label: day.label, slots: [] });
  }

  for (const row of timetable.rows ?? []) {
    if (row.isBreak || row.isLunch) continue;
    for (const entry of row.entries ?? []) {
      const subject =
        entry.course?.title ??
        entry.teachingSubjectGroup?.title ??
        entry.course?.code ??
        entry.teachingSubjectGroup?.code;
      if (!subject) continue;

      const bucket = grouped.get(row.dayOfWeek);
      if (!bucket) continue;

      bucket.slots.push({
        id: entry.id,
        startTime: row.startTime,
        endTime: row.endTime,
        subject,
        sectionCode: entry.sectionCode,
        semesterNo: entry.semesterSequence,
        classroom: entry.classroom?.name ?? entry.classroom?.code ?? null,
        shiftName: entry.shiftName ?? null,
        slotType: entry.slotType,
      });
    }
  }

  return dayOrder
    .map((day) => ({
      dayOfWeek: day.value,
      label: day.label,
      slots: grouped.get(day.value)?.slots ?? [],
    }))
    .filter((day) => day.slots.length > 0);
}

export type FacultyTimetableSlot = {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
  sectionCode?: string | null;
  semesterNo?: number | null;
  classroom?: string | null;
  shiftName?: string | null;
  slotType?: string;
};
