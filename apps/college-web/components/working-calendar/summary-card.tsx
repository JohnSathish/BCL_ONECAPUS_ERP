'use client';

import { BarChart3, CalendarDays, PartyPopper, Sun } from 'lucide-react';

type Props = {
  workingDays: number;
  weekends: number;
  publicHolidays: number;
  optionalHolidays: number;
};

export function SummaryCard({ workingDays, weekends, publicHolidays, optionalHolidays }: Props) {
  const rows = [
    {
      label: 'Working Days',
      value: workingDays,
      icon: CalendarDays,
      tone: 'text-[#1E3A8A] bg-[#EFF6FF]',
    },
    {
      label: 'Weekends',
      value: weekends,
      icon: Sun,
      tone: 'text-[#2563EB] bg-blue-50',
    },
    {
      label: 'Public Holidays',
      value: publicHolidays,
      icon: PartyPopper,
      tone: 'text-[#EF4444] bg-rose-50',
    },
    {
      label: 'Optional Holidays',
      value: optionalHolidays,
      icon: BarChart3,
      tone: 'text-violet-600 bg-violet-50',
    },
  ] as const;

  return (
    <section className="rounded-[16px] border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] to-white p-5 shadow-[0_8px_30px_rgba(37,99,235,0.08)]">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#1E3A8A]" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-[#1E293B]">Monthly Summary</h3>
          <p className="text-[11px] text-[#64748B]">Total Working Days</p>
        </div>
      </div>
      <p className="mb-5 text-4xl font-bold tracking-tight text-[#1E3A8A]">{workingDays}</p>
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-white/80 bg-white/70 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-[#475569]">
              <span className={`rounded-lg p-1.5 ${row.tone}`}>
                <row.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              {row.label}
            </span>
            <strong className="text-sm font-semibold text-[#1E293B]">{row.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
