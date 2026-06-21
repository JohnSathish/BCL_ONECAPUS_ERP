'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { fetchIaSettings } from '@/services/examinations-ia';
import { IA_ADMIT_CARDS_ADMIN_ENABLED } from '@/lib/examinations/ia-feature-flags';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';

const NAV_ITEMS = [
  { href: BASE, label: 'Dashboard', exact: true },
  { href: `${BASE}/internal-assessments`, label: 'Internal Assessments' },
  { href: `${BASE}/timetable`, label: 'IA Timetable' },
  { href: `${BASE}/mark-entry`, label: 'IA Mark Entry' },
  { href: `${BASE}/consolidation`, label: 'Consolidation' },
  { href: `${BASE}/nehu-submission`, label: 'NEHU Submission' },
  { href: `${BASE}/defaulters`, label: 'Defaulters' },
  { href: `${BASE}/analytics`, label: 'Analytics' },
  { href: `${BASE}/admit-cards`, label: 'Admit Cards' },
  { href: `${BASE}/reports`, label: 'Reports' },
  { href: `${BASE}/settings`, label: 'Settings' },
];

export function IaExaminationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const settings = useQuery({ queryKey: ['ia', 'settings'], queryFn: fetchIaSettings });

  const navItems = (
    settings.data?.legacyUniversityExamMode
      ? [...NAV_ITEMS, { href: `${BASE}/legacy`, label: 'Legacy University Exams' }]
      : NAV_ITEMS
  ).filter((item) => IA_ADMIT_CARDS_ADMIN_ENABLED || !item.href.endsWith('/admit-cards'));

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              NEHU Internal Assessment
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <ClipboardList className="h-6 w-6 text-primary" />
              Examination Module
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Internal Assessment &amp; Continuous Evaluation for Don Bosco College Tura.
              End-semester university exams remain with NEHU.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-border/60 bg-card p-2">
        <nav className="flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
