export type CalendarDate = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateKey: string;
  timeKey: string;
};

export type BirthdayWhen = 'PAST' | 'TODAY' | 'FUTURE';
export type BirthdayWishStatus =
  | 'SENT'
  | 'FAILED'
  | 'QUEUED'
  | 'PENDING'
  | 'UPCOMING'
  | 'MISSED';

export type BirthdayChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'WHATSAPP' | 'PUSH';

const CHANNELS = new Set<BirthdayChannel>([
  'EMAIL',
  'IN_APP',
  'SMS',
  'WHATSAPP',
  'PUSH',
]);

export function istCalendar(date = new Date()): CalendarDate {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour: Number(hour),
    minute: Number(parts.minute),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    timeKey: `${hour}:${parts.minute}`,
  };
}

export function addCalendarDays(
  date: Pick<CalendarDate, 'year' | 'month' | 'day'>,
  days: number,
): Pick<CalendarDate, 'year' | 'month' | 'day'> {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Inclusive calendar span, plus 29 Feb on 28 Feb in a non-leap year. */
export function monthDayPairs(
  start: Pick<CalendarDate, 'year' | 'month' | 'day'>,
  days: number,
) {
  const pairs: Array<{ month: number; day: number }> = [];
  const seen = new Set<string>();
  const push = (month: number, day: number) => {
    const key = `${month}-${day}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ month, day });
  };
  for (let offset = 0; offset < days; offset += 1) {
    const date = addCalendarDays(start, offset);
    push(date.month, date.day);
    if (date.month === 2 && date.day === 28 && !isLeapYear(date.year)) {
      push(2, 29);
    }
  }
  return pairs;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function istDayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(
    Date.UTC(year, month - 1, day, 0, 0) - 5.5 * 60 * 60 * 1000,
  );
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function birthdayChannels(channels?: string[]): BirthdayChannel[] {
  const picked = (channels ?? ['IN_APP', 'PUSH'])
    .map((channel) => channel.toUpperCase())
    .filter((channel): channel is BirthdayChannel =>
      CHANNELS.has(channel as BirthdayChannel),
    );
  const set = new Set<BirthdayChannel>(
    picked.length ? picked : ['IN_APP', 'PUSH'],
  );
  if (set.has('PUSH')) set.add('IN_APP');
  return [...set];
}

export function normalizeBirthdayTemplate(text: string) {
  return text
    .replace(/\{name\}/gi, '{{name}}')
    .replace(/\{department\}/gi, '{{department}}')
    .replace(/\{college_name\}/gi, '{{college_name}}');
}

export function birthdayVariables(input: {
  fullName: string;
  department?: string | null;
  collegeName: string;
  code?: string | null;
  programme?: string | null;
  semester?: number | null;
}) {
  const name = input.fullName;
  const department = input.department ?? '';
  const college = input.collegeName;
  return {
    name,
    student_name: name,
    staff_name: name,
    department,
    department_name: department,
    college_name: college,
    institution_name: college,
    roll_number: input.code ?? '',
    programme: input.programme ?? '',
    program_name: input.programme ?? '',
    semester: input.semester ? String(input.semester) : '',
  };
}

export function classifyWish(input: {
  when: BirthdayWhen;
  hasTrigger: boolean;
  delivery: 'NONE' | 'SUCCESS' | 'FAILED' | 'QUEUED';
}): BirthdayWishStatus {
  if (input.delivery === 'SUCCESS') return 'SENT';
  if (input.delivery === 'FAILED') return 'FAILED';
  if (input.hasTrigger || input.delivery === 'QUEUED') return 'QUEUED';
  if (input.when === 'TODAY') return 'PENDING';
  if (input.when === 'FUTURE') return 'UPCOMING';
  return 'MISSED';
}

export function normalizeSendTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}
