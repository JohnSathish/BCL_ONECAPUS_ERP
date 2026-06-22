'use client';

import { RECRUITMENT_TIMELINE } from '@/lib/careers-portal/constants';

export function CareersRecruitmentTimeline() {
  return (
    <section className="border-t border-white/10 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
        Your Journey
      </p>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Recruitment Process</h2>

      {/* Desktop */}
      <div className="mt-14 hidden items-center justify-center gap-2 lg:flex">
        {RECRUITMENT_TIMELINE.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{step.label}</p>
            </div>
            {i < RECRUITMENT_TIMELINE.length - 1 ? (
              <span className="mx-4 text-xl text-amber-400/70" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="mt-10 flex flex-col items-center gap-1 lg:hidden">
        {RECRUITMENT_TIMELINE.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center">
            <p className="py-2 text-sm font-semibold text-white">{step.label}</p>
            {i < RECRUITMENT_TIMELINE.length - 1 ? (
              <span className="text-lg text-amber-400/70" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
