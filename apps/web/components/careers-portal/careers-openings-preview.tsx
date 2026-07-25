'use client';

import Link from 'next/link';
import type { CareersJob } from '@/services/careers-portal';
import { CareersOpeningsTable } from '@/components/careers-portal/careers-openings-table';

export function CareersOpeningsPreview({ jobs }: { jobs: CareersJob[] }) {
  const preview = jobs.slice(0, 12);

  return (
    <section id="life" className="bg-[#f4f6fa] py-14 sm:py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">
              Open Positions
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[#0b1f4a] sm:text-4xl">
              Explore Current Vacancies
            </h2>
          </div>
          {jobs.length > preview.length ? (
            <Link
              href="/careers-portal/jobs"
              className="text-sm font-semibold text-[#1d4ed8] transition hover:text-[#0b1f4a]"
            >
              View all vacancies →
            </Link>
          ) : null}
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {preview.length > 0 ? (
            <div className="careers-light-table p-2 sm:p-4">
              <CareersOpeningsTable jobs={preview} tone="light" />
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-slate-500">
                No vacancies published at the moment. Please check back soon.
              </p>
              <Link
                href="/careers-portal/apply"
                className="mt-4 inline-flex rounded-lg bg-[#0b1f4a] px-6 py-2.5 text-sm font-semibold text-white"
              >
                Register Interest
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
