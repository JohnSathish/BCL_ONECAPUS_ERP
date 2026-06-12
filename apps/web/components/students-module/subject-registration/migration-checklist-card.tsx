'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck, CheckCircle2, Circle, CircleDashed } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import type { MigrationStatusDto, MigrationStepDto } from '@/services/students';
import { cn } from '@/utils/cn';

type Props = {
  status?: MigrationStatusDto | null;
  loading?: boolean;
  onGenerateRegistrations?: () => void;
  onImportSubjects?: () => void;
  canGenerate?: boolean;
  canImport?: boolean;
};

const STATIC_STEPS = [
  {
    id: 'students',
    title: 'Import students + NEP papers',
    description:
      'Upload Sem 1 admission Excel (Major, MDC Choice, AEC, SEC, VAC) with section A / B / Core.',
    href: '/admin/students/sem-1-migration',
    actionLabel: 'Sem 1 Migration Studio',
  },
  {
    id: 'compulsory',
    title: 'Generate compulsory registrations',
    description: 'Create draft registrations and auto-assign compulsory subjects only.',
    actionLabel: 'Generate registrations',
  },
  {
    id: 'subjects',
    title: 'Import subject selections',
    description: 'Upload wide-format Excel with Major, Minor, MDC, AEC, SEC, VAC, and VTC columns.',
    actionLabel: 'Import Excel',
  },
  {
    id: 'timetable',
    title: 'Publish section-aware timetable',
    description:
      'Build routine slots per section (A / B / Core) and publish so student portals match enrolment.',
    href: '/admin/academics/timetable',
    actionLabel: 'Open timetable',
  },
  {
    id: 'freeze',
    title: 'Freeze and hand off',
    description: 'Freeze registration when allocations are final, then enable attendance and fees.',
  },
] as const;

function StepIcon({ step }: { step?: MigrationStepDto }) {
  if (!step || step.status === 'pending') {
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
  if (step.status === 'partial') {
    return <CircleDashed className="h-4 w-4 text-amber-600" />;
  }
  return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
}

export function MigrationChecklistCard({
  status,
  loading,
  onGenerateRegistrations,
  onImportSubjects,
  canGenerate = true,
  canImport = true,
}: Props) {
  const stepById = new Map(status?.steps.map((s) => [s.id, s]) ?? []);

  return (
    <CompactCard>
      <CompactCardHeader
        title="Migration checklist"
        description={
          status
            ? `${status.totalStudents} students in ${status.batchCode} · Sem ${status.semesterSequence}`
            : 'Recommended pipeline for onboarding offline-admitted batches (Sem 1 / 3 / 5).'
        }
      />
      <CompactCardBody className="space-y-3">
        <ol className="space-y-3">
          {STATIC_STEPS.map((step, index) => {
            const live = stepById.get(step.id);
            return (
              <li
                key={step.id}
                className={cn(
                  'flex gap-3 rounded-lg border px-3 py-3',
                  live?.status === 'complete'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : live?.status === 'partial'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-border/70 bg-muted/20',
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {loading ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold">
                      {index + 1}
                    </span>
                  ) : (
                    <StepIcon step={live} />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  {live?.detail ? (
                    <p className="text-xs font-medium text-foreground/80">{live.detail}</p>
                  ) : null}
                  {'href' in step && step.href ? (
                    <Link
                      href={step.href}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'mt-2 inline-flex h-8 gap-1',
                      )}
                    >
                      {'actionLabel' in step ? step.actionLabel : 'Open'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : step.id === 'compulsory' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8"
                      disabled={!canGenerate}
                      onClick={onGenerateRegistrations}
                    >
                      {step.actionLabel}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : step.id === 'subjects' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8"
                      disabled={!canImport}
                      onClick={onImportSubjects}
                    >
                      {step.actionLabel}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Circle className="h-3 w-3" />
                      Use Freeze on this page after prior steps
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          Compulsory-only bulk generate leaves elective slots empty for wide subject import.
        </div>
      </CompactCardBody>
    </CompactCard>
  );
}
