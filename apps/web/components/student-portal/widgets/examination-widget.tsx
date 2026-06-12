'use client';

import Link from 'next/link';
import { Award, Calendar, FileCheck, Ticket } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StudentDashboardView } from '@/types/student-portal';
import { cn } from '@/utils/cn';

const LINKS = [
  { href: '/student/results', label: 'Internal Marks', icon: Award },
  { href: '/student/results', label: 'Semester Results', icon: FileCheck },
  { href: '/student/examinations', label: 'Hall Ticket', icon: Ticket },
  { href: '/student/examinations', label: 'Exam Schedule', icon: Calendar },
];

export function ExaminationWidget({
  exams,
  loading,
}: {
  exams?: StudentDashboardView['examinations'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-muted" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold tracking-tight">Examination</h3>
      {exams?.cgpa != null ? (
        <p className="mt-1 text-xs text-muted-foreground">Latest SGPA: {exams.cgpa}</p>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'h-auto flex-col gap-1 rounded-xl border-border/50 bg-background/40 py-3 text-xs',
              )}
            >
              <Icon className="h-4 w-4 text-primary" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}
