'use client';

import { Sparkles } from 'lucide-react';

export function HrRecruitmentHeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-[#1e3a5f] via-[#234a72] to-[#1e3a5f] px-6 py-8 text-white shadow-lg">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 20%, rgba(200,16,46,0.35), transparent 45%), radial-gradient(circle at 10% 80%, rgba(56,189,248,0.2), transparent 40%)',
        }}
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            HR Hiring Control Center
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Recruitment &amp; ATS</h2>
          <p className="mt-2 max-w-2xl text-sm text-sky-100/90">
            Manage vacancies, track candidates through the pipeline, schedule interviews, and issue
            appointment orders — all integrated with{' '}
            <span className="font-medium text-white">career.donboscocollege.ac.in</span>.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
          <p className="text-xs uppercase tracking-wider text-sky-200/80">Don Bosco College</p>
          <p className="text-lg font-bold">Tura</p>
          <p className="text-xs text-sky-100/70">NAAC Accredited</p>
        </div>
      </div>
    </div>
  );
}
