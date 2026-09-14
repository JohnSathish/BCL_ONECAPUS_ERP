'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/admin/school-sis/timetable', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/timetable/weekly', label: 'Weekly' },
  { href: '/admin/school-sis/timetable/class', label: 'Class-wise' },
  { href: '/admin/school-sis/timetable/teacher', label: 'Teacher-wise' },
  { href: '/admin/school-sis/timetable/mine', label: 'My Timetable' },
  { href: '/admin/school-sis/timetable/settings', label: 'Periods' },
  { href: '/admin/school-sis/timetable/conflicts', label: 'Conflicts' },
  { href: '/admin/school-sis/timetable/print', label: 'Print / Export' },
];

export function TimetableChrome({
  title,
  hint,
  children,
  actions,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c5a572]">
            Academic · Timetable
          </p>
          <h1 className="text-2xl font-semibold text-[#1a365d]">{title}</h1>
          {hint ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{hint}</p> : null}
        </div>
        {actions}
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {LINKS.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium',
                active ? 'bg-[#1a365d] text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function printedClock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(hr).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
}

export function printedRange(start: string, end: string) {
  return `${printedClock(start)}–${printedClock(end)}`;
}
