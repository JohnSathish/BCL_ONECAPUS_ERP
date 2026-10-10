'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  IdCard,
  PenLine,
  Settings,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { fetchIaSettings } from '@/services/examinations-ia';
import { IA_ADMIT_CARDS_ADMIN_ENABLED } from '@/lib/examinations/ia-feature-flags';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';

const ExamHeaderAsideContext = createContext<((node: React.ReactNode) => void) | null>(null);

export function useExamHeaderAside() {
  return useContext(ExamHeaderAsideContext);
}

const NAV_ITEMS = [
  { href: BASE, label: 'Dashboard', exact: true, icon: LayoutDashboard },
  { href: `${BASE}/ia-exams`, label: 'IA Exams', icon: FileText },
  { href: `${BASE}/timetable`, label: 'IA Timetable', icon: CalendarDays },
  { href: `${BASE}/admit-cards`, label: 'Admit Cards', icon: IdCard },
  { href: `${BASE}/mark-entry`, label: 'Mark Entry', icon: PenLine },
  { href: `${BASE}/defaulters`, label: 'Defaulters', icon: TriangleAlert },
  { href: `${BASE}/analytics`, label: 'Analytics', icon: BarChart3 },
  { href: `${BASE}/reports`, label: 'Reports', icon: ClipboardList },
  { href: `${BASE}/nehu-submission`, label: 'University Submission', icon: Upload },
  { href: `${BASE}/settings`, label: 'Settings', icon: Settings },
];

export function IaExaminationShell({
  children,
  banner = true,
}: {
  children: React.ReactNode;
  banner?: boolean;
}) {
  const pathname = usePathname();
  const settings = useQuery({ queryKey: ['ia', 'settings'], queryFn: fetchIaSettings });
  const [headerAside, setHeaderAside] = useState<React.ReactNode>(null);

  const navItems = (
    settings.data?.legacyUniversityExamMode
      ? [...NAV_ITEMS, { href: `${BASE}/legacy`, label: 'Legacy University Exams' }]
      : NAV_ITEMS
  ).filter((item) => IA_ADMIT_CARDS_ADMIN_ENABLED || !item.href.endsWith('/admit-cards'));

  return (
    <ExamHeaderAsideContext.Provider value={setHeaderAside}>
      <div className="space-y-5">
        {banner ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">
                    NEHU Internal Assessment
                  </p>
                  <h2 className="mt-0.5 text-2xl font-bold text-slate-900">Examination Module</h2>
                  <p className="max-w-3xl text-sm text-slate-500">
                    Internal Assessment &amp; Continuous Evaluation for Don Bosco College Tura.
                    End-semester university exams remain with NEHU.
                  </p>
                </div>
              </div>
              {headerAside}
            </div>
          </section>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const active =
                'exact' in item && item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = 'icon' in item ? item.icon : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                    active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {children}
      </div>
    </ExamHeaderAsideContext.Provider>
  );
}
