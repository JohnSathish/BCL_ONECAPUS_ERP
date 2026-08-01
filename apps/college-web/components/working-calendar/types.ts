export type WorkingDayStatus =
  | 'working'
  | 'weekend'
  | 'saturday-working'
  | 'holiday'
  | 'break'
  | 'exam'
  | 'optional'
  | 'empty';

export type WorkingCalendarEvent = {
  title: string;
  type: string;
};

export type WorkingCalendarDay = {
  id: string;
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  statusLabel: string;
  description: string;
  isWorkingDay: boolean;
  isHighlighted: boolean;
  dayKind?: string;
  events?: WorkingCalendarEvent[];
};

export type WorkingCalendarMonth = {
  key: string;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  days: WorkingCalendarDay[];
};

export type DayVisual = {
  status: WorkingDayStatus;
  label: string;
  title?: string;
  events: WorkingCalendarEvent[];
};
