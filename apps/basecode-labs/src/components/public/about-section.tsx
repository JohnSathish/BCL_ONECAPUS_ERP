import Link from 'next/link';
import {
  Building2,
  Cloud,
  GraduationCap,
  Heart,
  MapPin,
  Play,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { COMPANY } from '@/lib/company';

const BADGE_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-orange-100 text-orange-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

const PARTNER_ITEMS = [
  {
    title: 'Web Design & Development',
    detail: 'Modern, responsive and scalable websites',
    icon: Building2,
    tone: 'bg-sky-500',
  },
  {
    title: 'ERP, school and college management software',
    detail: 'Digitise your institution, simplify operations',
    icon: GraduationCap,
    tone: 'bg-emerald-500',
  },
  {
    title: 'Android & iOS applications',
    detail: 'Powerful mobile apps for students, teachers and staff',
    icon: Smartphone,
    tone: 'bg-violet-500',
  },
  {
    title: 'Hosting, cloud and technical support',
    detail: 'Reliable infrastructure and expert support',
    icon: Cloud,
    tone: 'bg-orange-400',
  },
  {
    title: 'Offices in Tamil Nadu and Meghalaya',
    detail: 'Local presence, wider impact',
    icon: MapPin,
    tone: 'bg-cyan-500',
  },
];

const ABOUT_STATS = [
  { value: COMPANY.stats[1].value, label: 'Satisfied clients', icon: Users, color: 'text-sky-600' },
  {
    value: COMPANY.stats[0].value,
    label: 'Years of experience',
    icon: Sparkles,
    color: 'text-emerald-600',
  },
  {
    value: COMPANY.stats[2].value,
    label: 'Published client stories',
    icon: GraduationCap,
    color: 'text-violet-600',
  },
  { value: 'Trusted', label: 'Across North East', icon: Heart, color: 'text-orange-500' },
];

type Logo = { id: string; name: string; website: string | null };

export function AboutSection({ logos }: { logos: Logo[] }) {
  return (
    <>
      <section className="relative overflow-hidden bg-white py-10">
        <p className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          — Trusted by educational institutions —
        </p>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 px-4">
          {logos.map((logo, i) => (
            <a
              key={logo.id}
              href={logo.website ?? '#'}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${BADGE_COLORS[i % BADGE_COLORS.length]}`}
              >
                {logo.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </span>
              {logo.name}
            </a>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-white to-slate-50 py-16 lg:py-20">
        <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-[1.05fr_1.15fr] lg:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              About BaseCode Labs
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Technology. Innovation. <span className="text-blue-600">Partnership.</span>
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-600">
              {COMPANY.aboutBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/about"
                className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25"
              >
                Learn more →
              </Link>
              <Link
                href="/about#story"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Play className="ml-0.5 h-3 w-3 fill-current" />
                </span>
                Watch our story
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {ABOUT_STATS.map((stat) => (
                <div key={stat.label} className="flex items-start gap-2">
                  <stat.icon className={`mt-0.5 h-5 w-5 ${stat.color}`} />
                  <div>
                    <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                    <div className="text-[11px] leading-snug text-slate-500">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] bg-[#123056] shadow-[0_30px_80px_rgba(15,40,80,0.28)]">
            <div className="grid min-h-[360px] lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative z-10 p-6 sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                  Your Technology Growth Partner
                </p>
                <ul className="mt-6 space-y-4">
                  {PARTNER_ITEMS.map((item) => (
                    <li key={item.title} className="flex gap-3">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone} text-white shadow-md`}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-white">{item.title}</span>
                        <span className="block text-xs text-sky-100/80">{item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative min-h-[220px] overflow-hidden">
                <img
                  src="/images/about/hero-5.jpg"
                  alt="BaseCode Labs team collaborating on software"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#123056]/10 to-[#123056]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#123056]/50 to-transparent" />
                <p className="absolute bottom-8 right-5 max-w-[8rem] text-right font-serif text-2xl italic leading-tight text-white drop-shadow-lg sm:bottom-10 sm:right-8 sm:text-3xl">
                  Building
                  <br />
                  Brighter
                  <br />
                  Futures
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
