'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Briefcase,
  Building2,
  ChevronRight,
  Play,
  Search,
  Users,
  Wrench,
} from 'lucide-react';
import { CareersHeroCarousel } from '@/components/careers-portal/careers-hero-carousel';
import type { CareersJob, CareersPortalInfo } from '@/services/careers-portal';

function countByStaffType(jobs: CareersJob[]) {
  const teaching = jobs.filter((j) => (j.staffType ?? '').toUpperCase().includes('TEACH'));
  const admin = jobs.filter((j) => {
    const t = (j.staffType ?? '').toUpperCase();
    return t.includes('NON') || t.includes('ADMIN') || t.includes('OFFICE');
  });
  const support = jobs.filter((j) => {
    const t = (j.staffType ?? '').toUpperCase();
    return t.includes('SUPPORT') || t.includes('CONTRACT') || t.includes('GUEST');
  });
  const teachingCount = teaching.reduce((n, j) => n + (j.vacanciesCount || 1), 0);
  const adminCount = admin.reduce((n, j) => n + (j.vacanciesCount || 1), 0);
  const supportCount = support.reduce((n, j) => n + (j.vacanciesCount || 1), 0);
  const accounted = new Set([...teaching, ...admin, ...support].map((j) => j.id));
  const other = jobs
    .filter((j) => !accounted.has(j.id))
    .reduce((n, j) => n + (j.vacanciesCount || 1), 0);
  return {
    teaching: teachingCount,
    admin: adminCount,
    support: supportCount + other,
    total: jobs.reduce((n, j) => n + (j.vacanciesCount || 1), 0) || jobs.length,
  };
}

export function CareersHeroSection({
  info,
  heroImages,
  jobs = [],
}: {
  info?: CareersPortalInfo;
  heroImages?: string[];
  jobs?: CareersJob[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const counts = useMemo(() => countByStaffType(jobs), [jobs]);
  const departments = useMemo(() => {
    const names = new Set<string>();
    for (const job of jobs) {
      if (job.department?.name) names.add(job.department.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (department) params.set('department', department);
    const qs = params.toString();
    router.push(qs ? `/careers-portal/jobs?${qs}` : '/careers-portal/jobs');
  };

  return (
    <section className="relative w-full overflow-hidden">
      {/* Full-bleed campus hero */}
      <div className="relative min-h-[640px] lg:min-h-[720px]">
        <div className="absolute inset-0">
          <CareersHeroCarousel heroImages={heroImages} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1f4a]/92 via-[#0b1f4a]/70 to-[#0b1f4a]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f4a]/50 via-transparent to-[#0b1f4a]/40" />
        </div>

        <div className="relative mx-auto grid max-w-[1400px] gap-10 px-4 pb-28 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-36 lg:pt-36">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#f0b429]">
              — Build your future with us
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]">
              Inspire Young Minds.
              <br />
              Build a Better Tomorrow.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              {info?.portalSubtitle ||
                `Join ${info?.collegeName ?? 'Don Bosco College, Tura'} — a values-driven community shaping educators, leaders, and professionals for Northeast India.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/careers-portal/jobs"
                className="inline-flex items-center gap-2 rounded-lg bg-[#f0b429] px-6 py-3.5 text-sm font-bold text-[#0b1f4a] shadow-lg shadow-black/20 transition hover:bg-[#ffc84a]"
              >
                <Briefcase className="h-4 w-4" />
                View Openings
              </Link>
              <a
                href={info?.websiteUrl || 'https://donboscocollege.ac.in'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/70 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch Video
              </a>
            </div>
          </div>

          {/* Current openings card */}
          <div className="justify-self-end w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl shadow-black/25 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4d6] text-[#d97706]">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-bold text-[#0b1f4a]">Current Openings</p>
                  <p className="text-xs text-slate-500">Live vacancies on the portal</p>
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums text-[#ea580c]">
                {String(counts.total).padStart(2, '0')}
              </p>
            </div>

            <ul className="mt-5 space-y-2">
              {[
                {
                  label: 'Teaching Faculty',
                  count: counts.teaching,
                  href: '/careers-portal/jobs?staffType=TEACHING',
                  icon: Users,
                  tone: 'bg-sky-50 text-sky-700',
                },
                {
                  label: 'Administrative Staff',
                  count: counts.admin,
                  href: '/careers-portal/jobs?staffType=NON_TEACHING',
                  icon: Building2,
                  tone: 'bg-violet-50 text-violet-700',
                },
                {
                  label: 'Support Staff',
                  count: counts.support,
                  href: '/careers-portal/jobs',
                  icon: Wrench,
                  tone: 'bg-emerald-50 text-emerald-700',
                },
              ].map((row) => (
                <li key={row.label}>
                  <Link
                    href={row.href}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 transition hover:border-[#f0b429]/50 hover:bg-[#fffbf0]"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${row.tone}`}
                      >
                        <row.icon className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-[#0b1f4a]">
                        {row.label}{' '}
                        <span className="font-bold text-[#ea580c]">
                          ({String(row.count).padStart(2, '0')})
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href="/careers-portal/jobs"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d4ed8] transition hover:text-[#1e3a8a]"
            >
              View All Openings
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Overlapping search bar */}
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2 px-4 sm:px-6">
          <form
            onSubmit={onSearch}
            className="mx-auto flex max-w-[1400px] flex-col gap-3 rounded-2xl bg-[#0b1f4a] p-3 shadow-2xl shadow-black/30 sm:flex-row sm:items-center sm:gap-2 sm:p-2.5"
          >
            <label className="relative flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 sm:py-3">
              <Search className="h-4 w-4 shrink-0 text-[#f0b429]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Job title, keyword or department..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/50"
                aria-label="Search jobs"
              />
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="rounded-xl border-0 bg-white/5 px-3 py-3 text-sm text-white outline-none sm:min-w-[180px]"
              aria-label="Department"
            >
              <option value="" className="text-[#0b1f4a]">
                All Departments
              </option>
              {departments.map((name) => (
                <option key={name} value={name} className="text-[#0b1f4a]">
                  {name}
                </option>
              ))}
            </select>
            <div className="hidden items-center rounded-xl bg-white/5 px-3 py-3 text-sm text-white/80 lg:flex lg:min-w-[160px]">
              Tura, Meghalaya
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0b429] px-5 py-3 text-sm font-bold text-[#0b1f4a] transition hover:bg-[#ffc84a]"
            >
              <Search className="h-4 w-4" />
              Search Jobs
            </button>
          </form>
        </div>
      </div>

      {/* Spacer for overlapping search */}
      <div className="h-16 bg-[#f4f6fa] sm:h-20" />
    </section>
  );
}
