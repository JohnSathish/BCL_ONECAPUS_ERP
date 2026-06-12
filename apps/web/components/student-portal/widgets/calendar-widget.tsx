'use client';

import { GlassCard } from '@/components/erp/glass-card';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LEGEND = [
  { color: 'bg-rose-500', label: 'Exams' },
  { color: 'bg-emerald-500', label: 'Holidays' },
  { color: 'bg-sky-500', label: 'Assignments' },
  { color: 'bg-amber-500', label: 'Fee Due' },
];

export function StudentCalendarWidget({ loading }: { loading?: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="mt-4 h-40 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });

  const eventDays = new Set([today + 2, today + 5, today + 12].filter((d) => d <= daysInMonth));

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold tracking-tight">Student Calendar</h3>
      <p className="text-xs text-muted-foreground">{monthLabel}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1 font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={
              day === today
                ? 'relative rounded-md bg-primary py-1.5 font-bold text-primary-foreground'
                : day
                  ? 'relative rounded-md py-1.5 text-foreground/80'
                  : 'py-1.5'
            }
          >
            {day ?? ''}
            {day && eventDays.has(day) ? (
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-500" />
            ) : null}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
          >
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>
    </GlassCard>
  );
}
