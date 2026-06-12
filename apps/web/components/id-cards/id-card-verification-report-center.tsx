'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileText, Loader2, Printer } from 'lucide-react';

import {
  buildIdVerificationReport,
  openIdVerificationReportPreview,
} from '@/components/id-cards/export-id-verification-report';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

export function IdCardVerificationReportCenter() {
  const enabled = useAuthQueryEnabled();
  const { branding } = useInstitutionBranding();

  const [departmentId, setDepartmentId] = useState('');
  const [semester, setSemester] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [scope, setScope] = useState<'department' | 'all-departments'>('department');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const departmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });
  const yearsQ = useQuery({
    queryKey: ['academic-years'],
    queryFn: fetchAcademicYears,
    enabled,
  });

  const departmentName = useMemo(
    () =>
      departmentId ? (departmentsQ.data ?? []).find((d) => d.id === departmentId)?.name : undefined,
    [departmentId, departmentsQ.data],
  );
  const sessionName = useMemo(
    () => (sessionId ? (yearsQ.data ?? []).find((y) => y.id === sessionId)?.name : undefined),
    [sessionId, yearsQ.data],
  );

  const runReport = async () => {
    if (scope === 'department' && !departmentId) {
      setMessage('Select a department for department-wise verification report.');
      return;
    }

    setGenerating(true);
    setMessage('Loading student records…');
    setLastSummary(null);

    try {
      const result = await buildIdVerificationReport({
        branding: branding ?? undefined,
        departmentName,
        sessionName,
        filters: {
          departmentId: scope === 'department' ? departmentId : undefined,
          semester: semester || undefined,
          sessionId: sessionId || undefined,
          academicStatus: 'ACTIVE',
          groupByDepartment: scope === 'all-departments',
        },
        onProgress: (progress) => {
          if (progress.phase === 'profiles') {
            setMessage(`Loading student profiles ${progress.done}/${progress.total}…`);
          } else if (progress.phase === 'building') {
            setMessage('Building verification report…');
          }
        },
      });

      const sectionSummary = result.sections
        .map((s) => `${s.departmentName} (${s.rows.length})`)
        .join(', ');
      setLastSummary(
        `${result.meta.totalStudents} students · ${result.sections.length} section(s): ${sectionSummary}`,
      );

      openIdVerificationReportPreview(result.html, result.meta.reportTitle);
      setMessage('Report opened in a new window — use Print report when ready.');
    } catch (e) {
      setMessage(apiErrorMessage(e, 'Could not generate verification report'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">ID Verification Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Print a department-wise checklist before ID card production. Students verify name,
          registration number, programme, photo, and other card fields — then note corrections
          before cards are printed.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary">
          <ClipboardCheck className="h-4 w-4" />
          Report scope
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Print mode</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'department' | 'all-departments')}
            >
              <option value="department">Single department</option>
              <option value="all-departments">All departments (one section each)</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">
              Department {scope === 'department' ? '(required)' : '(optional filter)'}
            </span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">
                {scope === 'department' ? 'Select department…' : 'All departments'}
              </option>
              {(departmentsQ.data ?? []).map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Semester</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">All semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Academic year</span>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">All sessions</option>
              {(yearsQ.data ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button disabled={generating} onClick={() => void runReport()}>
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Generate &amp; print report
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/id-cards/students">
              <FileText className="mr-2 h-4 w-4" /> Production center
            </Link>
          </Button>
        </div>

        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        {lastSummary ? <p className="mt-2 text-xs text-muted-foreground">{lastSummary}</p> : null}
      </div>

      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Recommended workflow</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Print verification report department-wise and distribute to students.</li>
          <li>Collect signed sheets with corrections and update student records in the ERP.</li>
          <li>Run bulk generate and bulk PDF export only after verification is complete.</li>
          <li>Print physical ID cards on CR80 stock.</li>
        </ol>
      </div>
    </div>
  );
}
