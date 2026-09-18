'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, Heart, Quote, Star, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/cn';

type Item = {
  id: string;
  name: string;
  designation: string;
  organisation: string;
  quote: string;
  photo: string | null;
  rating: number;
};

type Logo = { id: string; name: string; website: string | null; industry: string | null };

const BADGE_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-orange-100 text-orange-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

const HIGHLIGHTS = [
  'user-friendly interface',
  'professionalism, technical expertise, and responsive communication',
];

function initials(name: string) {
  const words = name
    .replace(/[–—\-/,]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !['of', 'the', 'and'].includes(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function EmphasizedQuote({ quote }: { quote: string }) {
  const nodes = useMemo(() => {
    let remaining = quote;
    const out: ReactNode[] = [];
    HIGHLIGHTS.forEach((phrase, i) => {
      const at = remaining.toLowerCase().indexOf(phrase.toLowerCase());
      if (at === -1) return;
      if (at > 0) out.push(remaining.slice(0, at));
      out.push(
        <strong key={phrase} className="font-semibold text-blue-700">
          {remaining.slice(at, at + phrase.length)}
        </strong>,
      );
      remaining = remaining.slice(at + phrase.length);
      void i;
    });
    if (remaining) out.push(remaining);
    return out;
  }, [quote]);
  return <>{nodes}</>;
}

export function TestimonialsSection({ items, logos }: { items: Item[]; logos: Logo[] }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const item = items[index];
  const prev = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];
  const go = (dir: number) => setIndex((i) => (i + dir + items.length) % items.length);

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-slate-50 py-16 lg:py-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
              — Testimonials —
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
              What our <span className="text-blue-600">clients say</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Real stories. Real impact. Hear from the institutions we are proud to work with.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-5 w-5 text-sky-600" />
              <span>
                <span className="block font-bold text-slate-900">{COMPANY.stats[1].value}</span>
                <span className="text-xs">{COMPANY.stats[1].label}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              <span>
                <span className="block font-bold text-slate-900">{COMPANY.stats[2].value}</span>
                <span className="text-xs">{COMPANY.stats[2].label}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Heart className="h-5 w-5 text-sky-500" />
              <span>
                <span className="block font-bold text-slate-900">Long-term</span>
                <span className="text-xs">Partnerships</span>
              </span>
            </div>
            <div className="ml-2 hidden gap-2 sm:flex">
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() => go(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() => go(1)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative mt-10">
          <button
            type="button"
            aria-label="Previous testimonial"
            onClick={() => go(-1)}
            className="absolute left-0 top-1/2 z-20 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg lg:flex"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <button
            type="button"
            aria-label="Next testimonial"
            onClick={() => go(1)}
            className="absolute right-0 top-1/2 z-20 hidden h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg lg:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            {prev.photo ? (
              <button
                type="button"
                onClick={() => go(-1)}
                className="hidden w-24 shrink-0 opacity-40 lg:block"
                aria-label={`Show ${prev.name}`}
              >
                <Image
                  src={prev.photo}
                  alt=""
                  width={96}
                  height={120}
                  className="h-36 w-24 rounded-3xl object-cover object-top"
                />
              </button>
            ) : (
              <div className="hidden w-24 shrink-0 lg:block" />
            )}

            <figure className="relative flex-1 overflow-hidden rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:p-8">
              <p className="pointer-events-none absolute bottom-8 right-8 hidden max-w-[130px] rotate-[-12deg] text-right font-serif text-xl italic leading-tight text-sky-300 lg:block">
                Building Brighter Futures Together
              </p>
              <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
                <div className="relative mx-auto w-[180px]">
                  {item.photo ? (
                    <div className="overflow-hidden rounded-[22px] bg-sky-100">
                      <Image
                        src={item.photo}
                        alt={item.name}
                        width={180}
                        height={210}
                        className="h-[210px] w-full object-cover object-top"
                      />
                    </div>
                  ) : (
                    <div className="flex h-[210px] w-full items-center justify-center rounded-[22px] bg-sky-100 text-2xl font-bold text-sky-700">
                      {initials(item.name)}
                    </div>
                  )}
                  <div className="absolute -bottom-4 left-1/2 w-[92%] -translate-x-1/2 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-center shadow-md">
                    <span className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-[11px] font-bold text-rose-700">
                      {initials(item.organisation)}
                    </span>
                    <p className="text-[10px] font-semibold leading-tight text-slate-700">
                      {item.organisation.split(',')[0]}
                    </p>
                  </div>
                </div>
                <blockquote className="relative pt-2">
                  <Quote className="absolute -top-1 left-0 h-10 w-10 text-sky-200" />
                  <span className="absolute right-0 top-0 hidden rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 sm:inline-flex sm:items-center sm:gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Trusted Partner
                  </span>
                  <p className="relative mt-6 text-[15px] leading-7 text-slate-700 sm:mt-4 sm:pr-28">
                    “<EmphasizedQuote quote={item.quote} />”
                  </p>
                  <figcaption className="mt-5">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-sm text-slate-500">
                      {item.designation}, {item.organisation}
                    </div>
                    <div
                      className="mt-2 flex gap-0.5 text-amber-400"
                      aria-label={`${item.rating} star rating`}
                    >
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                  </figcaption>
                </blockquote>
              </div>
            </figure>

            {next.photo ? (
              <button
                type="button"
                onClick={() => go(1)}
                className="hidden w-24 shrink-0 opacity-40 lg:block"
                aria-label={`Show ${next.name}`}
              >
                <Image
                  src={next.photo}
                  alt=""
                  width={96}
                  height={120}
                  className="h-36 w-24 rounded-3xl object-cover object-top"
                />
              </button>
            ) : (
              <div className="hidden w-24 shrink-0 lg:block" />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {items.map((t, i) => (
            <button
              key={t.id}
              type="button"
              aria-label={`Show testimonial ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2.5 rounded-full transition',
                i === index ? 'w-6 bg-blue-600' : 'w-2.5 bg-slate-300',
              )}
            />
          ))}
        </div>

        {logos.length ? (
          <div className="mt-10 flex flex-wrap items-start justify-center gap-x-8 gap-y-4 border-t border-slate-100 pt-8">
            {logos.map((logo, i) => {
              const match = items.findIndex(
                (t) =>
                  t.organisation.toLowerCase().includes(logo.name.toLowerCase().slice(0, 12)) ||
                  logo.name
                    .toLowerCase()
                    .includes(t.organisation.split(',')[0].toLowerCase().slice(0, 12)),
              );
              return (
                <button
                  key={logo.id}
                  type="button"
                  onClick={() => {
                    if (match >= 0) setIndex(match);
                  }}
                  className="flex max-w-[140px] flex-col items-center gap-2 text-center"
                >
                  <span
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold',
                      BADGE_COLORS[i % BADGE_COLORS.length],
                    )}
                  >
                    {initials(logo.name)}
                  </span>
                  <span className="text-[11px] font-medium leading-tight text-slate-600">
                    {logo.name}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TestimonialCarousel({ items }: { items: Item[] }) {
  return <TestimonialsSection items={items} logos={[]} />;
}
