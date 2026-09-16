'use client';

import { Suspense } from 'react';
import { HrOrgDesk } from '@/components/school-sis/hr/hr-org';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <HrOrgDesk />
    </Suspense>
  );
}
