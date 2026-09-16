'use client';

import { Suspense } from 'react';
import { HrLeaveDesk } from '@/components/school-sis/hr/hr-leave';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading…</p>}>
      <HrLeaveDesk />
    </Suspense>
  );
}
