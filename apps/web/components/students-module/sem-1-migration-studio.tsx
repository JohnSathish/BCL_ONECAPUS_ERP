'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Upload,
} from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import { downloadSem1AdmissionTemplate } from '@/services/students';
import { cn } from '@/utils/cn';

const WORKFLOW_STEPS = [
  {
    id: 'catalog',
    icon: BookOpen,
    title: 'Confirm course catalog',
    description:
      'Ensure Sem 1 Arts papers (Major, Minor, MDC, AEC, SEC, VAC) are seeded with sections A / B / Core.',
    href: '/admin/academics/courses',
    action: 'Open courses',
    optional: true,
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import students + NEP selections',
    description:
      'Upload your admission Excel directly. Columns like Major Subject, MDC Choice, AEC, SEC, VAC map automatically. Use Section Code or Tutorial Group for A / B / Core.',
    href: '/admin/students/import',
    action: 'Student Import Studio',
  },
  {
    id: 'registration',
    icon: FileSpreadsheet,
    title: 'Refine registrations (optional)',
    description:
      'For Sem 3/5 or per-paper section overrides, use wide-format subject registration import with Section Code column.',
    href: '/admin/students/subject-registration',
    action: 'Subject registration',
    optional: true,
  },
  {
    id: 'timetable',
    icon: CalendarDays,
    title: 'Build & publish timetable',
    description:
      'Create routine slots per section (A / B / Core). After publish, each student sees only their enrolled section slots.',
    href: '/admin/academics/timetable',
    action: 'Timetable workspace',
  },
  {
    id: 'verify',
    icon: GraduationCap,
    title: 'Verify student routines',
    description:
      'Open a student profile or portal preview and confirm Major/Minor/MDC slots match their section enrolment.',
    href: '/admin/students',
    action: 'Student directory',
  },
] as const;

const COLUMN_MAP = [
  {
    admission: 'Application Number',
    erp: 'Registration Number',
    note: 'Used when roll not yet assigned',
  },
  { admission: 'Full Name', erp: 'Full Name', note: 'Required' },
  { admission: 'Email', erp: 'Email', note: 'Required' },
  { admission: 'Mobile Number', erp: 'Mobile', note: 'Student contact' },
  { admission: 'Shift', erp: 'Shift', note: 'DAY / Morning / Evening code' },
  { admission: 'Programme', erp: 'Programme', note: 'BA-ECO, BA-GEO, etc.' },
  { admission: 'Admission Batch', erp: 'Admission Batch', note: 'BATCH-2026' },
  { admission: 'Stream', erp: 'Stream', note: 'ARTS' },
  { admission: 'Major Subject', erp: 'Major Subject', note: 'ECO-100 or subject name' },
  { admission: 'Minor Subject', erp: 'Minor Subject', note: 'Course code or name' },
  { admission: 'MDC Choice', erp: 'MDC Choice', note: 'Mapped to MDC paper' },
  { admission: 'AEC', erp: 'AEC', note: 'Ability Enhancement paper' },
  { admission: 'SEC', erp: 'SEC', note: 'Skill Enhancement paper' },
  { admission: 'VAC', erp: 'VAC', note: 'Value Added Course' },
  { admission: 'Section Code', erp: 'Section Code', note: 'A, B, or Core for all papers' },
  { admission: 'Address in Tura', erp: 'Tura Address Line 1', note: 'Campus / local address' },
  { admission: 'Home Address', erp: 'Home Address Line 1', note: 'Permanent address' },
  {
    admission: 'Father / Mother / Guardian fields',
    erp: 'Profile columns',
    note: 'Mapped for future profile enrichment',
  },
  {
    admission: 'Board / Class XII / CUET fields',
    erp: 'Profile columns',
    note: 'Preserved on import for eligibility review',
  },
];

export function Sem1MigrationStudio() {
  const downloadTemplate = useCallback(async () => {
    const blob = await downloadSem1AdmissionTemplate();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Sem1_Admission_Import_Template.xlsx';
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-card to-card p-6 shadow-lg shadow-black/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Layers className="h-3.5 w-3.5" />
              FYUGP Sem 1 onboarding
            </span>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Sem 1 Migration Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Load real admission data, map NEP paper selections, assign sections (A / B / Core),
              and align published timetables with actual enrolment — without retyping student
              records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-2 rounded-xl font-semibold shadow-sm"
              onClick={() => void downloadTemplate()}
            >
              <Download className="h-4 w-4" />
              Download admission template
            </Button>
            <Link
              href="/admin/students/import"
              className={cn(
                buttonVariants({ size: 'sm', variant: 'outline' }),
                'gap-2 rounded-xl font-semibold shadow-sm',
              )}
            >
              <Upload className="h-4 w-4" />
              Start import
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <CompactCard>
          <CompactCardHeader
            title="Recommended workflow"
            description="Follow these steps once per admission batch. Steps marked optional can be skipped for a straight Sem 1 Arts import."
          />
          <CompactCardBody>
            <ol className="space-y-3">
              {WORKFLOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.id}
                    className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Step {index + 1}
                        </span>
                        {'optional' in step && step.optional ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Optional
                          </span>
                        ) : null}
                        <p className="text-sm font-medium">{step.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                      <Link
                        href={step.href}
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          'mt-2 inline-flex h-8 gap-1',
                        )}
                      >
                        {step.action}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CompactCardBody>
        </CompactCard>

        <div className="space-y-4">
          <CompactCard>
            <CompactCardHeader
              title="Admission Excel column map"
              description="Your Sem 1 registration export maps to the student import template automatically."
            />
            <CompactCardBody className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Your Excel</th>
                    <th className="pb-2 pr-3 font-medium">ERP column</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMN_MAP.map((row) => (
                    <tr key={row.admission} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 font-medium">{row.admission}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.erp}</td>
                      <td className="py-2 text-muted-foreground">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Section tips" />
            <CompactCardBody className="space-y-2 text-xs text-muted-foreground">
              <p>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                One <strong className="font-medium text-foreground">Section Code</strong> column
                applies to all NEP papers (e.g. Core for MDC/AEC/SEC/VAC pools).
              </p>
              <p>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                Use <strong className="font-medium text-foreground">Major Section</strong>,{' '}
                <strong className="font-medium text-foreground">MDC Section</strong>, etc. when
                different papers need different sections.
              </p>
              <p>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                Timetable slots tagged with a section show only to students enrolled in that
                section.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full gap-2"
                onClick={() => void downloadTemplate()}
              >
                <Download className="h-3.5 w-3.5" />
                Download admission template
              </Button>
              <Button asChild variant="ghost" size="sm" className="mt-1 w-full">
                <Link href="/admin/students/import">Open Student Import Studio</Link>
              </Button>
            </CompactCardBody>
          </CompactCard>
        </div>
      </div>
    </div>
  );
}
