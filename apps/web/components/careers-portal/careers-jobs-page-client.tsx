'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { CareersPublicShell } from '@/components/careers-portal/careers-public-shell';
import { CareersOpeningsTable } from '@/components/careers-portal/careers-openings-table';
import { Input } from '@/components/ui/input';
import { fetchCareersJobs } from '@/services/careers-portal';

export function CareersJobsPageClient() {
  const searchParams = useSearchParams();
  const departmentFilter = searchParams.get('department')?.trim() ?? '';
  const [query, setQuery] = useState('');
  const jobsQ = useQuery({ queryKey: ['careers-jobs'], queryFn: fetchCareersJobs });
  const jobs = jobsQ.data ?? [];

  const filtered = useMemo(() => {
    let list = jobs;
    if (departmentFilter) {
      list = list.filter(
        (j) => j.department?.name?.toLowerCase() === departmentFilter.toLowerCase(),
      );
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.department?.name?.toLowerCase().includes(q) ||
        j.designation?.label?.toLowerCase().includes(q),
    );
  }, [jobs, query, departmentFilter]);

  return (
    <CareersPublicShell>
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
          Vacancies
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          {departmentFilter ? `${departmentFilter} — Openings` : 'Current Openings'}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          {departmentFilter
            ? `Published vacancies in the Department of ${departmentFilter}.`
            : 'Faculty and staff opportunities at Don Bosco College, Tura. Select a position to view details and apply online.'}
        </p>
        <div className="relative mt-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by title or department…"
            className="border-white/15 bg-transparent pl-10 text-white placeholder:text-slate-500"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {jobsQ.isLoading ? (
        <p className="text-slate-400">Loading openings…</p>
      ) : (
        <CareersOpeningsTable
          jobs={filtered}
          emptyMessage={
            query.trim()
              ? 'No positions match your search.'
              : 'No open positions at the moment. Please check back soon.'
          }
        />
      )}
    </CareersPublicShell>
  );
}
