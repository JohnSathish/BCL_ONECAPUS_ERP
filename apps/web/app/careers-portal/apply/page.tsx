'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CareersPublicShell } from '@/components/careers-portal/careers-public-shell';
import { CareersOpeningsTable } from '@/components/careers-portal/careers-openings-table';
import { fetchCareersJobs } from '@/services/careers-portal';

function CareersApplyPageContent() {
  const search = useSearchParams();
  const vacancyId = search.get('vacancyId');
  const jobsQ = useQuery({ queryKey: ['careers-jobs'], queryFn: fetchCareersJobs });
  const jobs = jobsQ.data ?? [];
  const filtered = vacancyId ? jobs.filter((j) => j.id === vacancyId) : jobs;

  return (
    <CareersPublicShell>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
        Apply online
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Select a Position</h1>
      <p className="mt-3 max-w-2xl text-slate-400">
        Choose a vacancy below to start your application. You can save a draft and continue later on
        this device.
      </p>

      <div className="mt-10">
        {jobsQ.isLoading ? (
          <p className="text-slate-400">Loading openings…</p>
        ) : (
          <CareersOpeningsTable
            jobs={filtered}
            emptyMessage="No open positions at the moment. Please check back soon."
          />
        )}
      </div>
    </CareersPublicShell>
  );
}

export default function CareersApplyPage() {
  return (
    <Suspense fallback={<p className="p-8 text-slate-400">Loading…</p>}>
      <CareersApplyPageContent />
    </Suspense>
  );
}
