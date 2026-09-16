'use client';

import { Suspense } from 'react';
import { HrEmployeesDesk } from '@/components/school-sis/hr/hr-employees';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading employees…</p>}>
      <HrEmployeesDesk />
    </Suspense>
  );
}
