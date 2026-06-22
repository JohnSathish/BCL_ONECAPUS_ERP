'use client';

import { Suspense } from 'react';
import { CareersJobsPageClient } from '@/components/careers-portal/careers-jobs-page-client';

export default function CareersJobsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Loading openings…</p>}>
      <CareersJobsPageClient />
    </Suspense>
  );
}
