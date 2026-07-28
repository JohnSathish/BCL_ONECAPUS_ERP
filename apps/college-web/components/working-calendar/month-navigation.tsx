'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { WorkingCalendarMonth } from './types';

type Props = {
  months: WorkingCalendarMonth[];
  activeKey: string;
  hrefForMonth: (key: string) => string;
};

export function MonthNavigation({ months, activeKey, hrefForMonth }: Props) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Calendar months">
      {months.map((month) => {
        const active = month.key === activeKey;
        return (
          <Link
            key={month.key}
            href={hrefForMonth(month.key)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition-all duration-250',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2',
              active
                ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white shadow-[0_8px_20px_rgba(30,58,138,0.28)]'
                : 'border-[#E5E7EB] bg-white text-[#1E293B] hover:border-[#2563EB]/40 hover:bg-[#EFF6FF]',
            )}
          >
            {month.title}
          </Link>
        );
      })}
    </nav>
  );
}
