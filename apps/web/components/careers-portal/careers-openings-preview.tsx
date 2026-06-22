'use client';

import Link from 'next/link';
import type { CareersJob } from '@/services/careers-portal';
import { CareersOpeningsTable } from '@/components/careers-portal/careers-openings-table';

export function CareersOpeningsPreview({ jobs }: { jobs: CareersJob[] }) {
  const preview = jobs.slice(0, 12);

  return (
    <section className="py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
            Open Positions
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Current Openings</h2>
        </div>
        {jobs.length > preview.length ? (
          <Link
            href="/careers-portal/jobs"
            className="text-sm font-medium text-sky-300 transition hover:text-white"
          >
            View all vacancies →
          </Link>
        ) : null}
      </div>

      <div className="mt-10">
        {preview.length > 0 ? (
          <CareersOpeningsTable jobs={preview} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-slate-400">
              No vacancies published at the moment. Please check back soon.
            </p>
            <Link
              href="/careers-portal/apply"
              className="mt-4 inline-flex rounded-full bg-[#c8102e] px-6 py-2.5 text-sm font-semibold text-white"
            >
              Apply Online
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
