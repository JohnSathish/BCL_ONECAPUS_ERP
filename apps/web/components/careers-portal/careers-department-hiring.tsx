'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CareersJob } from '@/services/careers-portal';

export function CareersDepartmentHiring({ jobs }: { jobs: CareersJob[] }) {
  const hiringDepts = useMemo(() => {
    const names = new Set<string>();
    for (const job of jobs) {
      if (job.department?.name) names.add(job.department.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  if (!hiringDepts.length) return null;

  return (
    <section className="border-t border-slate-200 py-16 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">
        Openings by department
      </p>
      <h2 className="mt-3 text-3xl font-bold text-[#0b1f4a] sm:text-4xl">
        Departments Currently Hiring
      </h2>
      <p className="mt-3 max-w-2xl text-slate-600">
        These academic departments have published vacancies at Don Bosco College, Tura.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {hiringDepts.map((name) => (
          <Link
            key={name}
            href={`/careers-portal/jobs?department=${encodeURIComponent(name)}`}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#0b1f4a] shadow-sm transition hover:border-[#f0b429] hover:bg-[#fffbf0]"
          >
            {name}
          </Link>
        ))}
      </div>
    </section>
  );
}
