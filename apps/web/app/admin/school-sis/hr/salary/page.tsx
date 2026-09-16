'use client';

import { Suspense } from 'react';
import { HrSalaryDesk } from '@/components/school-sis/hr/hr-salary';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <HrSalaryDesk />
    </Suspense>
  );
}
