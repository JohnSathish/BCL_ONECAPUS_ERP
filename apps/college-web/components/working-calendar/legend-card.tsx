'use client';

import { CalendarDays, CircleDot } from 'lucide-react';

const ITEMS = [
  { label: 'Working Day', className: 'bg-[#22C55E]' },
  { label: 'Weekend', className: 'bg-[#2563EB]' },
  { label: 'Working on Saturday', className: 'bg-[#F59E0B]' },
  { label: 'Holiday', className: 'bg-[#EF4444]' },
  { label: 'Optional Holiday', className: 'bg-violet-500' },
] as const;

export function LegendCard() {
  return (
    <section className="rounded-[16px] border border-[#E5E7EB] bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <CircleDot className="h-4 w-4 text-[#1E3A8A]" aria-hidden />
        <h3 className="text-sm font-semibold text-[#1E293B]">Legend</h3>
      </div>
      <ul className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-sm text-[#475569]">
            <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-[#94A3B8]">
        <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Saturday may be a working day depending on the published handbook calendar.
      </p>
    </section>
  );
}
