export const SCHOOL_WEEK_DAYS = [1, 2, 3, 4, 5] as const;

export const ST_LUKES_BELLS: Array<{
  kind: 'PERIOD' | 'BREAK';
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  periodNumber: number | null;
}> = [
  {
    kind: 'PERIOD',
    code: 'P1',
    label: '1st Period',
    startTime: '09:00',
    endTime: '09:55',
    sortOrder: 1,
    periodNumber: 1,
  },
  {
    kind: 'PERIOD',
    code: 'P2',
    label: '2nd Period',
    startTime: '09:55',
    endTime: '10:35',
    sortOrder: 2,
    periodNumber: 2,
  },
  {
    kind: 'BREAK',
    code: 'R1',
    label: 'Short Break',
    startTime: '10:35',
    endTime: '10:50',
    sortOrder: 3,
    periodNumber: null,
  },
  {
    kind: 'PERIOD',
    code: 'P3',
    label: '3rd Period',
    startTime: '10:50',
    endTime: '11:30',
    sortOrder: 4,
    periodNumber: 3,
  },
  {
    kind: 'PERIOD',
    code: 'P4',
    label: '4th Period',
    startTime: '11:30',
    endTime: '12:10',
    sortOrder: 5,
    periodNumber: 4,
  },
  {
    kind: 'BREAK',
    code: 'R2',
    label: 'Lunch/Break',
    startTime: '12:10',
    endTime: '12:40',
    sortOrder: 6,
    periodNumber: null,
  },
  {
    kind: 'PERIOD',
    code: 'P5',
    label: '5th Period',
    startTime: '12:40',
    endTime: '13:20',
    sortOrder: 7,
    periodNumber: 5,
  },
  {
    kind: 'PERIOD',
    code: 'P6',
    label: '6th Period',
    startTime: '13:20',
    endTime: '13:55',
    sortOrder: 8,
    periodNumber: 6,
  },
  {
    kind: 'PERIOD',
    code: 'P7',
    label: '7th Period',
    startTime: '13:55',
    endTime: '14:30',
    sortOrder: 9,
    periodNumber: 7,
  },
];

export function printedClock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hr).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function printedRange(start: string, end: string) {
  return `${printedClock(start)}–${printedClock(end)}`;
}

export function dayName(day: number) {
  return (
    [
      '',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ][day] ?? `Day ${day}`
  );
}

export function istNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    dayOfWeek: map[weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
