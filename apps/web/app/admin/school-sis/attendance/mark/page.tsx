'use client';

import { Suspense } from 'react';
import { AttendanceMarkDesk } from '@/components/school-sis/attendance/attendance-mark';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Loading attendance…</p>}>
      <AttendanceMarkDesk />
    </Suspense>
  );
}
