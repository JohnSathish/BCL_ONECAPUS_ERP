'use client';

import { GlassCard } from '@/components/erp/glass-card';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarWidget({ loading }: { loading?: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

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
  const today = now.getDate();

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold tracking-tight">Calendar</h3>
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
                ? 'rounded-md bg-primary py-1.5 font-bold text-primary-foreground'
                : day
                  ? 'rounded-md py-1.5 text-foreground/80'
                  : 'py-1.5'
            }
          >
            {day ?? ''}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Classes, meetings, exams, leave, and events will appear here.
      </p>
    </GlassCard>
  );
}
