'use client';

import { Suspense } from 'react';
import { SchoolSisStudentsDirectory } from '@/components/school-sis/school-sis-students-directory';

export default function SchoolSisStudentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading students…</p>}>
      <SchoolSisStudentsDirectory />
    </Suspense>
  );
}
