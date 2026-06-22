'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, Search } from 'lucide-react';
import { CareersHeroCarousel } from '@/components/careers-portal/careers-hero-carousel';
import type { CareersPortalInfo } from '@/services/careers-portal';

const ROLE_LINES = ['Assistant Professors', 'Associate Professors', 'Non-Teaching Staff'] as const;

export function CareersHeroSection({
  info,
  heroImages,
}: {
  info?: CareersPortalInfo;
  heroImages?: string[];
}) {
  return (
    <section className="relative w-full overflow-hidden bg-[#0a1628] lg:min-h-[640px]">
      <div className="careers-hero-grid careers-hero-grid-drift absolute inset-0 opacity-15" />

      <div className="relative h-52 w-full lg:hidden">
        <CareersHeroCarousel heroImages={heroImages} />
      </div>

      <div className="relative mx-auto grid max-w-[1400px] lg:grid-cols-2 lg:min-h-[640px]">
        <div className="flex flex-col justify-center px-6 py-14 sm:px-10 lg:py-20 xl:px-16">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-400/90">
            {info?.collegeName?.toUpperCase() ?? 'DON BOSCO COLLEGE TURA'}
          </p>

          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Join Our Academic Community
          </h1>

          <ul className="mt-8 space-y-2">
            {ROLE_LINES.map((role) => (
              <li key={role} className="text-lg text-slate-300 sm:text-xl">
                {role}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/careers-portal/apply"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c8102e] px-8 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#a50d25]"
            >
              Apply Now
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/careers-portal/jobs"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-[#1e3a5f] transition hover:bg-sky-50"
            >
              <Briefcase className="h-5 w-5" />
              View Vacancies
            </Link>
            <Link
              href="/careers-portal/application-status"
              className="inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white/90 transition hover:text-white"
            >
              <Search className="h-5 w-5" />
              Track Application
            </Link>
          </div>
        </div>

        <div className="relative hidden min-h-[640px] lg:block">
          <CareersHeroCarousel heroImages={heroImages} />
        </div>
      </div>
    </section>
  );
}
