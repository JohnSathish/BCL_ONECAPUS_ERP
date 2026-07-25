'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  ChevronDown,
  GraduationCap,
  Heart,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { CAREERS_FAQ, WHY_JOIN_DBC } from '@/lib/careers-portal/constants';
import { cn } from '@/utils/cn';

const WHY_ICONS = {
  graduation: GraduationCap,
  microscope: GraduationCap,
  trending: TrendingUp,
  heart: Heart,
  building: Award,
  award: Award,
} as const;

const WHY_TONES = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
] as const;

export function CareersWhyJoin({ collegeName }: { collegeName?: string }) {
  const name = collegeName ?? 'Don Bosco College, Tura';
  return (
    <section id="why-join" className="bg-[#eef1f6] py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">
            Why join {name}?
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-[#0b1f4a] sm:text-4xl">
            A Place to Grow.
            <br />A Purpose to Fulfill.
          </h2>
          <div className="mt-4 h-1 w-14 rounded-full bg-[#f0b429]" />
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
            Be part of a NAAC-accredited Don Bosco institution where teaching, research, and
            community service come together — with room to grow your career and make a lasting
            difference for students in Garo Hills and beyond.
          </p>
          <Link
            href="/careers-portal#about"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0b1f4a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#152a5c]"
          >
            Learn More About Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {WHY_JOIN_DBC.map((item, index) => {
            const Icon = WHY_ICONS[item.icon];
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/80 bg-white p-5 shadow-sm"
              >
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full',
                    WHY_TONES[index % WHY_TONES.length],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-[#0b1f4a]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CareersFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1d4ed8]">Help</p>
        <h2 className="mt-3 text-3xl font-bold text-[#0b1f4a] sm:text-4xl">
          Frequently Asked Questions
        </h2>
        <div className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-[#f8fafc]">
          {CAREERS_FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.question} className="px-4 sm:px-5">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="flex items-center gap-3 font-semibold text-[#0b1f4a]">
                    <Plus
                      className={cn(
                        'h-4 w-4 shrink-0 text-[#f0b429] transition',
                        isOpen && 'rotate-45',
                      )}
                    />
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-5 w-5 shrink-0 text-slate-400 transition',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen ? (
                  <p className="pb-5 pl-7 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
