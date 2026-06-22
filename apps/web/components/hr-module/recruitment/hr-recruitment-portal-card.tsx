'use client';

import Link from 'next/link';
import { ExternalLink, Globe, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RecruitmentStats, RecruitmentVacancy } from '@/services/hr';

export function HrRecruitmentPortalCard({
  stats,
  vacancies,
}: {
  stats?: RecruitmentStats;
  vacancies: RecruitmentVacancy[];
}) {
  const published = vacancies.filter((v) => v.status === 'PUBLISHED');
  const publicApps = stats?.totalApplications ?? 0;

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-[#1e3a5f] to-[#152a45] p-5 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-sky-300" />
          <p className="text-sm font-semibold">Careers Portal</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-200">
          <Radio className="h-3 w-3 animate-pulse" />
          LIVE
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-sky-200/80">career.donboscocollege.ac.in</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-2xl font-bold">{published.length}</p>
          <p className="text-xs text-sky-100/80">Open Jobs</p>
        </div>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="text-2xl font-bold">{publicApps}</p>
          <p className="text-xs text-sky-100/80">Applications</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button size="sm" variant="secondary" className="w-full" asChild>
          <Link href="/careers-portal" target="_blank">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Portal
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full border-white/30 bg-transparent text-white hover:bg-white/10"
          asChild
        >
          <Link href="/careers-portal/jobs" target="_blank">
            Preview Jobs
          </Link>
        </Button>
      </div>
    </div>
  );
}
