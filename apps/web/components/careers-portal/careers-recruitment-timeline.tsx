'use client';

import { RECRUITMENT_TIMELINE } from '@/lib/careers-portal/constants';

export function CareersRecruitmentTimeline() {
  return (
    <section className="border-t border-slate-200 py-16 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">Your Journey</p>
      <h2 className="mt-3 text-3xl font-bold text-[#0b1f4a] sm:text-4xl">Recruitment Process</h2>

      <div className="mt-12 hidden items-center justify-center gap-2 lg:flex">
        {RECRUITMENT_TIMELINE.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-center shadow-sm">
              <p className="text-sm font-semibold text-[#0b1f4a]">{step.label}</p>
            </div>
            {i < RECRUITMENT_TIMELINE.length - 1 ? (
              <span className="mx-3 text-xl text-[#f0b429]" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col items-center gap-1 lg:hidden">
        {RECRUITMENT_TIMELINE.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center">
            <p className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0b1f4a] shadow-sm">
              {step.label}
            </p>
            {i < RECRUITMENT_TIMELINE.length - 1 ? (
              <span className="py-1 text-lg text-[#f0b429]" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
