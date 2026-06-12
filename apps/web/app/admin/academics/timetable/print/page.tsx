'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer, X } from 'lucide-react';
import { TimetablePrintDocument } from '@/components/timetable/timetable-print-document';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { toBrandingDocumentContext } from '@/lib/branding-document';
import {
  fetchTimetableContext,
  fetchTimetableMatrix,
  fetchTimetablePlans,
} from '@/services/timetable';
import '@/styles/timetable-print.css';

function TimetablePrintPageContent() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const searchParams = useSearchParams();
  const printedRef = useRef(false);

  const planId = searchParams.get('planId') ?? '';
  const semester = searchParams.get('semester');
  const staffProfileId = searchParams.get('staffProfileId') ?? undefined;
  const classroomId = searchParams.get('classroomId') ?? undefined;
  const sectionCode = searchParams.get('sectionCode') ?? undefined;
  const autoprint = searchParams.get('autoprint') === '1';

  const { branding } = useInstitutionBranding();
  const brandingDoc = toBrandingDocumentContext(branding);

  useEffect(() => {
    document.body.classList.add('timetable-print-mode');
    return () => document.body.classList.remove('timetable-print-mode');
  }, []);

  const contextQ = useQuery({
    queryKey: ['timetable', 'context', 'print'],
    queryFn: fetchTimetableContext,
    enabled: authReady,
  });

  const plansQ = useQuery({
    queryKey: ['timetable', 'plans', 'print'],
    queryFn: () => fetchTimetablePlans(),
    enabled: authReady,
  });

  const matrixQ = useQuery({
    queryKey: [
      'timetable',
      'matrix',
      'print',
      planId,
      semester,
      staffProfileId,
      classroomId,
      sectionCode,
    ],
    queryFn: () =>
      fetchTimetableMatrix(planId, {
        semesterSequence: semester ? Number(semester) : undefined,
        staffProfileId,
        classroomId,
        sectionCode,
      }),
    enabled: authReady && Boolean(planId),
  });

  const plan = plansQ.data?.find((row) => row.id === planId);
  const ready = Boolean(planId && matrixQ.isSuccess && !matrixQ.isFetching);
  const generatedAt = useRef(new Date());

  useEffect(() => {
    if (!autoprint || !ready || printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoprint, ready]);

  return (
    <div className="timetable-print-shell">
      <div className="timetable-print-toolbar no-print">
        <div>
          <p className="text-sm font-semibold text-gray-900">Timetable Print Preview</p>
          <p className="text-xs text-gray-600">
            This view is optimized for A4 landscape printing and PDF export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => window.close()}>
            <X className="mr-2 h-3.5 w-3.5" />
            Close
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!ready}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {!planId ? (
        <p className="timetable-print-loading">
          Missing timetable plan. Close this tab and use Print from the timetable grid.
        </p>
      ) : matrixQ.isLoading || matrixQ.isFetching ? (
        <p className="timetable-print-loading">Preparing timetable for print…</p>
      ) : matrixQ.isError ? (
        <p className="timetable-print-loading">
          Unable to load timetable. Check your session and try again.
        </p>
      ) : (
        <TimetablePrintDocument
          matrix={matrixQ.data}
          plan={plan}
          context={contextQ.data}
          branding={brandingDoc}
          semesterFilter={semester ? Number(semester) : undefined}
          sectionFilter={sectionCode}
          generatedAt={generatedAt.current}
        />
      )}
    </div>
  );
}

export default function TimetablePrintPage() {
  return (
    <Suspense fallback={<p className="timetable-print-loading">Loading print view…</p>}>
      <TimetablePrintPageContent />
    </Suspense>
  );
}
