import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Code2,
  Database,
  Globe,
  GraduationCap,
  MapPin,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { COMPANY } from '@/lib/company';
import { cn } from '@/lib/cn';

type Service = { id: string; category: string; title: string };

const ORDER = ['Software Development', 'Web', 'Mobile', 'Infrastructure', 'Digital'] as const;

const THEMES: Record<
  string,
  {
    blurb: string;
    wrap: string;
    glow: string;
    icon: typeof Code2;
    deco: 'laptop' | 'browser' | 'phone' | 'servers' | 'chart';
  }
> = {
  'Software Development': {
    blurb: 'Custom software to streamline your institution’s operations.',
    wrap: 'from-[#143a9a] via-[#1d4ed8] to-[#2563eb]',
    glow: 'shadow-blue-900/40',
    icon: Code2,
    deco: 'laptop',
  },
  Web: {
    blurb: 'Modern, responsive and secure web solutions.',
    wrap: 'from-[#0f766e] via-[#0d9488] to-[#14b8a6]',
    glow: 'shadow-teal-900/40',
    icon: Globe,
    deco: 'browser',
  },
  Mobile: {
    blurb: 'Powerful mobile apps for students, teachers and staff.',
    wrap: 'from-[#5b21b6] via-[#7c3aed] to-[#8b5cf6]',
    glow: 'shadow-violet-900/40',
    icon: Smartphone,
    deco: 'phone',
  },
  Infrastructure: {
    blurb: 'Reliable and secure infrastructure for continuous growth.',
    wrap: 'from-[#9a3412] via-[#ea580c] to-[#f59e0b]',
    glow: 'shadow-orange-900/40',
    icon: Database,
    deco: 'servers',
  },
  Digital: {
    blurb: 'Increase your digital presence and reach the right audience.',
    wrap: 'from-[#14532d] via-[#15803d] to-[#22c55e]',
    glow: 'shadow-emerald-900/40',
    icon: BarChart3,
    deco: 'chart',
  },
};

const TRUST = [
  { icon: Shield, label: 'Trusted', sub: 'Partner' },
  { icon: GraduationCap, label: 'Educational', sub: 'Focus' },
  { icon: MapPin, label: 'Pan India', sub: 'Presence' },
  { icon: TrendingUp, label: 'Scalable', sub: 'Solutions' },
];

const FOOTER_STATS = [
  { icon: Building2, value: COMPANY.stats[1].value, label: COMPANY.stats[1].label },
  { icon: Users, value: COMPANY.stats[0].value, label: COMPANY.stats[0].label },
  { icon: Sparkles, value: COMPANY.stats[2].value, label: COMPANY.stats[2].label },
  { icon: MapPin, value: 'Pan India', label: 'Tamil Nadu & Meghalaya' },
];

function CardDeco({ kind }: { kind: 'laptop' | 'browser' | 'phone' | 'servers' | 'chart' }) {
  if (kind === 'laptop') {
    return (
      <div className="pointer-events-none absolute -bottom-8 -right-10 h-28 w-40 rotate-[-12deg] rounded-xl border border-white/20 bg-white/10 opacity-30">
        <div className="m-2 h-16 rounded-md bg-white/10" />
      </div>
    );
  }
  if (kind === 'browser') {
    return (
      <div className="pointer-events-none absolute -bottom-4 -right-6 flex gap-2 opacity-30">
        <div className="h-24 w-28 rotate-6 rounded-lg border border-white/20 bg-white/10" />
        <div className="h-20 w-24 -rotate-3 rounded-lg border border-white/20 bg-white/10" />
      </div>
    );
  }
  if (kind === 'phone') {
    return (
      <div className="pointer-events-none absolute -bottom-8 -right-4 h-36 w-20 rotate-12 rounded-[22px] border-4 border-white/25 bg-white/10 opacity-40" />
    );
  }
  if (kind === 'servers') {
    return (
      <div className="pointer-events-none absolute -bottom-4 -right-6 flex gap-1.5 opacity-30">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-24 w-10 rounded-md border border-white/20 bg-white/10" />
        ))}
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute bottom-4 right-3 flex h-16 items-end gap-1 opacity-30">
      {[10, 16, 12, 22, 18].map((h, i) => (
        <span key={i} className="w-2.5 rounded-t bg-white/50" style={{ height: h }} />
      ))}
    </div>
  );
}

export function ServicesSection({ services }: { services: Service[] }) {
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    acc[s.category] = acc[s.category] ?? [];
    acc[s.category].push(s);
    return acc;
  }, {});
  const categories = [
    ...ORDER.filter((c) => grouped[c]?.length),
    ...Object.keys(grouped).filter((c) => !ORDER.includes(c as (typeof ORDER)[number])),
  ];

  return (
    <section
      id="services"
      className="relative overflow-hidden bg-[#06152c] py-16 text-white lg:py-20"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[48%] opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.55) 1px, transparent 1.6px)',
          backgroundSize: '13px 13px',
          maskImage: 'linear-gradient(90deg, transparent 0%, black 28%)',
        }}
      />
      <div className="pointer-events-none absolute -right-8 top-10 hidden h-64 w-56 lg:block">
        <svg viewBox="0 0 200 240" className="h-full w-full fill-slate-400/25">
          <path d="M92 18c8 4 18 8 22 18 6 14 4 28-2 40 8 6 18 10 18 22-2 14-16 18-22 28 10 10 18 28 8 42-8 12-24 14-36 22-8 6-6 18-14 24-10 8-24 4-28-8-6-16 4-28 2-42-10-6-22-4-28-14-8-12 2-24 10-32 4-20 18-28 28-42 6-10 4-22 12-32 6-8 18-10 30-6z" />
        </svg>
      </div>
      <p className="pointer-events-none absolute right-8 top-36 hidden max-w-[140px] rotate-[-18deg] text-right font-serif text-2xl italic leading-tight text-sky-200/80 lg:block">
        Technology for a Brighter Tomorrow
      </p>

      <div className="relative mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-300">
              — Our services —
            </p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">
              End-to-end <span className="text-cyan-400">technology services</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              From idea to implementation for institutions in Tamil Nadu, Meghalaya and across
              India.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {TRUST.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs text-slate-200">
                <item.icon className="h-4 w-4 text-cyan-300" />
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="text-slate-400">{item.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {categories.map((category) => {
            const theme = THEMES[category] ?? THEMES.Digital;
            const Icon = theme.icon;
            const items = grouped[category] ?? [];
            return (
              <article
                key={category}
                className={cn(
                  'relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br p-5 shadow-xl',
                  theme.wrap,
                  theme.glow,
                )}
              >
                <CardDeco kind={theme.deco} />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="relative mt-4 text-lg font-semibold">
                  {category === 'Software Development' ? 'Software Development' : category}
                </h3>
                <p className="relative mt-2 text-[13px] leading-5 text-white/80">{theme.blurb}</p>
                <ul className="relative mt-4 space-y-1.5 text-[13px] text-white/90">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      {item.title}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/services#${category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-white/90"
                >
                  Learn more
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="grid flex-1 grid-cols-2 gap-4 lg:grid-cols-4">
            {FOOTER_STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
                  <stat.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">{stat.value}</p>
                  <p className="text-[11px] text-slate-400">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="max-w-xs border-t border-white/10 pt-3 text-sm italic text-slate-300 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            “Empowering institutions through technology and meaningful partnerships.”
          </p>
        </div>
      </div>
    </section>
  );
}
