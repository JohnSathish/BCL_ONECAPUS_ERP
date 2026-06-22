'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CareersPublicShell } from '@/components/careers-portal/careers-public-shell';
import { CareersJobDetailView } from '@/components/careers-portal/careers-job-detail-view';
import { Button } from '@/components/ui/button';
import { fetchCareersJob } from '@/services/careers-portal';

export default function CareersJobDetailClient({
  slug,
  initialJob,
}: {
  slug: string;
  initialJob: Awaited<ReturnType<typeof fetchCareersJob>> | null;
}) {
  const validInitialJob = initialJob?.id ? initialJob : undefined;

  const jobQ = useQuery({
    queryKey: ['careers-job', slug],
    queryFn: () => fetchCareersJob(slug),
    initialData: validInitialJob,
  });
  const job = jobQ.data;

  if (jobQ.isLoading && !job) {
    return (
      <CareersPublicShell>
        <p className="text-slate-400">Loading vacancy details…</p>
      </CareersPublicShell>
    );
  }

  if (!job) {
    return (
      <CareersPublicShell>
        <p className="text-slate-400">This vacancy is not available.</p>
        <Button asChild variant="outline" className="mt-4 border-white/20 text-white">
          <Link href="/careers-portal/jobs">Back to openings</Link>
        </Button>
      </CareersPublicShell>
    );
  }

  return (
    <CareersPublicShell>
      <CareersJobDetailView job={job} />
    </CareersPublicShell>
  );
}
