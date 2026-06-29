'use client';

import Link from 'next/link';
import { ArrowRight, FileSpreadsheet, Layers, Upload, Users } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const ALLOCATION_PATHS = [
  {
    id: 'import',
    icon: Upload,
    title: 'Path 1 — At student import',
    when: 'New admission batch (Sem 1) or bulk onboarding',
    detail:
      'Add Grp, Section Code, or Tutorial Group in your admission Excel. Use AEC Section, MDC Section, etc. when papers need different sections.',
    href: '/admin/students/import',
    action: 'Student Import Studio',
    columns: 'Grp · Section Code · AEC Section · MDC Section',
  },
  {
    id: 'subject-sections',
    icon: Layers,
    title: 'Path 2 — After registration',
    when: 'Students already exist (Sem 3/5) or sections created later',
    detail:
      'Create Section A/B on this page, then Auto divide or import Roll → Section for one subject at a time.',
    href: '/admin/academics/subject-sections',
    action: 'Subject Sections',
    columns: 'Roll Number, Section (CSV paste)',
  },
  {
    id: 'registration-import',
    icon: FileSpreadsheet,
    title: 'Path 3 — Registration import',
    when: 'Wide Excel with roll + semester + paper codes',
    detail:
      'Use Subject Registration import with Grp or Section Code column. Works for Sem 1, 3, or 5 wide-format sheets.',
    href: '/admin/students/subject-registration',
    action: 'Subject registration',
    columns: 'Registration Number · Semester · Grp · AEC · MDC',
  },
] as const;

export function SectionAllocationGuide({ compact = false }: { compact?: boolean }) {
  return (
    <CompactCard>
      <CompactCardHeader
        title="Three ways to assign sections"
        description="Use Path 1 for new batches, Path 2 when students are already registered, or Path 3 for wide registration Excel. All three can be used in the same institution."
      />
      <CompactCardBody>
        <div className={cn('grid gap-3', compact ? 'md:grid-cols-1' : 'md:grid-cols-3')}>
          {ALLOCATION_PATHS.map((path) => {
            const Icon = path.icon;
            return (
              <div
                key={path.id}
                className="flex flex-col rounded-xl border border-border/70 bg-muted/15 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium leading-tight">{path.title}</p>
                </div>
                <p className="text-[11px] font-medium text-primary">{path.when}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{path.detail}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Columns: <span className="font-medium text-foreground">{path.columns}</span>
                </p>
                <Link
                  href={path.href}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'mt-3 inline-flex h-8 gap-1 self-start',
                  )}
                >
                  {path.action}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Subject sections (A/B/Core) are separate from the student&apos;s official programme class.
          Hall tickets show the paper name only; sections are for classroom, timetable, and
          attendance.
        </p>
      </CompactCardBody>
    </CompactCard>
  );
}
