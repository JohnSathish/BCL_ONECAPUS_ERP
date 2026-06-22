'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { CalendarPlus, ExternalLink, FileBadge, Globe, PlusCircle, UserPlus } from 'lucide-react';
import { cn } from '@/utils/cn';

type Action = {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  accent: string;
};

export function HrRecruitmentQuickActions({
  onCreateVacancy,
  onScheduleInterview,
}: {
  onCreateVacancy: () => void;
  onScheduleInterview: () => void;
}) {
  const actions: Action[] = [
    {
      label: 'Create Vacancy',
      description: 'Open the vacancy wizard',
      icon: PlusCircle,
      onClick: onCreateVacancy,
      accent:
        'border-blue-200 bg-blue-50 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40',
    },
    {
      label: 'Schedule Interview',
      description: 'Book panel & venue',
      icon: CalendarPlus,
      onClick: onScheduleInterview,
      accent:
        'border-violet-200 bg-violet-50 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40',
    },
    {
      label: 'Appointment Order',
      description: 'Generate for selected',
      icon: FileBadge,
      href: '/admin/hr/appointment-orders/new',
      accent:
        'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40',
    },
    {
      label: 'Joining Reports',
      description: 'Verify new joiners',
      icon: UserPlus,
      href: '/admin/hr/joining-reports',
      accent:
        'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40',
    },
    {
      label: 'Careers Portal',
      description: 'Preview public site',
      icon: Globe,
      href: '/careers-portal',
      accent: 'border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {actions.map((action) => {
        const Icon = action.icon;
        const inner = (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/80 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
            {action.href ? (
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : null}
          </>
        );
        const className = cn(
          'flex items-center gap-3 rounded-2xl border p-4 text-left transition duration-200',
          action.accent,
        );
        if (action.href) {
          return (
            <Link
              key={action.label}
              href={action.href}
              target={action.href.startsWith('/careers') ? '_blank' : undefined}
              className={className}
            >
              {inner}
            </Link>
          );
        }
        return (
          <button key={action.label} type="button" onClick={action.onClick} className={className}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
