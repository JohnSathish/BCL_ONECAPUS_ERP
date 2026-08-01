'use client';

import Link from 'next/link';
import { Award, ClipboardCheck, GraduationCap, ScrollText } from 'lucide-react';

const LINKS = [
  {
    href: '/student/examinations',
    label: 'Examination',
    icon: ClipboardCheck,
    tone: 'from-violet-500 to-indigo-500 shadow-violet-500/25',
  },
  {
    href: '/student/results',
    label: 'Results',
    icon: GraduationCap,
    tone: 'from-emerald-500 to-teal-500 shadow-emerald-500/25',
  },
  {
    href: '/student/attendance',
    label: 'Attendance',
    icon: ScrollText,
    tone: 'from-sky-500 to-blue-500 shadow-sky-500/25',
  },
  {
    href: '/student/certificates',
    label: 'Certificates',
    icon: Award,
    tone: 'from-amber-500 to-orange-500 shadow-amber-500/25',
  },
] as const;

export function StudentQuickLinksCard() {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Links</h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-2 py-3 transition hover:-translate-y-0.5 hover:border-transparent hover:bg-white hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${item.tone}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 dark:text-slate-200">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
