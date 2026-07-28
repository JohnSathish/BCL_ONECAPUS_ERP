'use client';

import { ClipboardList } from 'lucide-react';

type Props = {
  events: Array<{ date: string; dayOfMonth: number; title: string }>;
};

export function EventsCard({ events }: Props) {
  return (
    <section className="rounded-[16px] border border-[#E5E7EB] bg-white/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[#2563EB]" aria-hidden />
        <h3 className="text-sm font-semibold text-[#1E293B]">Events / Notes</h3>
      </div>
      {events.length ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={`${event.date}-${event.title}`}
              className="flex gap-3 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E3A8A] text-xs font-bold text-white">
                {event.dayOfMonth}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1E293B]">{event.title}</p>
                <p className="text-[11px] text-[#64748B]">{event.date}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#64748B]">Add notes or important events for this month.</p>
      )}
    </section>
  );
}
