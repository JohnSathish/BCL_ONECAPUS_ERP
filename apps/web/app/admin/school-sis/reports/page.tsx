'use client';

import { Suspense } from 'react';
import { SchoolReportsDesk } from '@/components/school-sis/reports/reports-desk';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading reports…</p>}>
      <SchoolReportsDesk />
    </Suspense>
  );
}
