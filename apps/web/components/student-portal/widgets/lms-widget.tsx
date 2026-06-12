'use client';

import Link from 'next/link';
import { BookOpen, ClipboardList, FileText } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import type { StudentDashboardView } from '@/types/student-portal';

export function LmsWidget({
  lms,
  loading,
}: {
  lms?: StudentDashboardView['lms'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-20 rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-8 rounded bg-muted" />
          <div className="h-8 rounded bg-muted" />
        </div>
      </GlassCard>
    );
  }

  const rows = [
    { icon: ClipboardList, label: 'Pending Assignments', value: lms?.pendingAssignments ?? 0 },
    { icon: FileText, label: 'Notes Available', value: lms?.notesAvailable ?? 0 },
    { icon: BookOpen, label: 'Upcoming Tests', value: lms?.upcomingTests ?? 0 },
  ];

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">LMS</h3>
        <Link href="/student/lms" className="text-xs text-primary hover:underline">
          Open LMS
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                {row.label}
              </span>
              <span className="text-lg font-bold">{row.value}</span>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
