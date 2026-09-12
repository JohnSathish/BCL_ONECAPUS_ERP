'use client';

import { Suspense } from 'react';
import { SchoolSisCurriculumPage } from '@/components/school-sis/school-sis-curriculum-page';

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading subjects…</p>}>
      <SchoolSisCurriculumPage />
    </Suspense>
  );
}
