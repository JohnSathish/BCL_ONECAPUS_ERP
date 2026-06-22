'use client';

import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { CAREERS_FAQ, WHY_JOIN_DBC } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';
import { Award, BookOpen, Building2, GraduationCap, Heart, TrendingUp } from 'lucide-react';

const WHY_ICONS = {
  graduation: GraduationCap,
  microscope: BookOpen,
  trending: TrendingUp,
  heart: Heart,
  building: Building2,
  award: Award,
} as const;

export function CareersWhyJoin({ collegeName }: { collegeName?: string }) {
  return (
    <section className="border-t border-white/10 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">
        Life at DBC
      </p>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
        Why Join {collegeName ?? 'Don Bosco College'}?
      </h2>

      <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_JOIN_DBC.map((item) => {
          const Icon = WHY_ICONS[item.icon];
          return (
            <div key={item.title} className="flex gap-4">
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-amber-400/90" strokeWidth={1.5} />
              <div>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CareersFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="border-t border-white/10 py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400/90">Help</p>
      <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Frequently Asked Questions</h2>

      <div className="mt-10 divide-y divide-white/10">
        {CAREERS_FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.question}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left transition hover:text-sky-100"
              >
                <span className="flex items-center gap-3 font-medium text-white">
                  <Plus
                    className={cn(
                      'h-4 w-4 shrink-0 text-amber-400/90 transition',
                      isOpen && 'rotate-45',
                    )}
                  />
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 shrink-0 text-slate-500 transition',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              {isOpen ? (
                <p className="pb-5 pl-7 text-sm leading-relaxed text-slate-400">{item.answer}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
