export type WorkingDayStatus =
  | 'working'
  | 'weekend'
  | 'saturday-working'
  | 'holiday'
  | 'optional'
  | 'empty';

export type WorkingCalendarDay = {
  id: string;
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  statusLabel: string;
  description: string;
  isWorkingDay: boolean;
  isHighlighted: boolean;
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
  events: string[];
};
