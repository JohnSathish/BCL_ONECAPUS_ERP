export type PortalCalendarEventType = 'exam' | 'holiday' | 'assignment' | 'fee' | 'event';

export type PortalCalendarEvent = {
  id: string;
  date: string;
  type: PortalCalendarEventType;
  title: string;
  subtitle?: string | null;
};

export function monthBounds(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export function dateKey(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function eventsByDay(events: PortalCalendarEvent[]) {
  const map = new Map<string, PortalCalendarEvent[]>();
  for (const event of events) {
    const list = map.get(event.date) ?? [];
    list.push(event);
    map.set(event.date, list);
  }
  return map;
}

export const CALENDAR_EVENT_COLORS: Record<
  PortalCalendarEventType,
  { dot: string; label: string }
> = {
  exam: { dot: 'bg-rose-500', label: 'Exams' },
  holiday: { dot: 'bg-emerald-500', label: 'Holidays' },
  assignment: { dot: 'bg-sky-500', label: 'Assignments' },
  fee: { dot: 'bg-amber-500', label: 'Fee Due' },
  event: { dot: 'bg-violet-500', label: 'Events' },
};
