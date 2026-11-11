'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentPromotionWorkspace } from '@/components/students-module/student-promotion-workspace';

export default function StudentPromotionPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Promotion">
          <div />
        </DashboardShell>
      }
    >
      <StudentPromotionPageContent />
    </Suspense>
  );
}

function StudentPromotionPageContent() {
  const searchParams = useSearchParams();
  const selectedStudentCount = useMemo(() => {
    const raw = searchParams.get('studentIds') ?? searchParams.get('ids');
    if (!raw || raw === 'bulk') return 0;
    return raw.split(',').filter(Boolean).length;
  }, [searchParams]);
  const semester = Number(searchParams.get('semester'));

  return (
    <DashboardShell
      role="admin"
      title="Promotion"
      subtitle="Review eligible and blocked students, then confirm before any academic records change."
    >
      <StudentPromotionWorkspace
        selectedStudentCount={selectedStudentCount}
        initialSemester={Number.isInteger(semester) && semester > 0 ? semester : undefined}
        initialBatchId={searchParams.get('batchId') ?? ''}
        initialShiftId={searchParams.get('shiftId') ?? ''}
      />
    </DashboardShell>
  );
}
