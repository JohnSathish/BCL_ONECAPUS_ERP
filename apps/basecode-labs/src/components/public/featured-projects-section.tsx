'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Church,
  GraduationCap,
  Heart,
  School,
  Sparkles,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMPANY } from '@/lib/company';
import { FALLBACK_PROJECTS } from '@/lib/published-catalog';
import { cn } from '@/lib/cn';

type Project = {
  id: string;
  name: string;
  slug: string;
  clientName: string;
  industry: string;
  services: string;
  description: string;
  websiteUrl: string | null;
};

const FILTERS = ['All', 'Diocese / Religious', 'Colleges', 'Schools', 'Higher Secondary'] as const;

const THEMES: Record<
  string,
  { wrap: string; iconWrap: string; label: string; icon: typeof Church }
> = {
  'Diocese / Religious': {
    wrap: 'border-sky-100 from-sky-50 to-white',
    iconWrap: 'bg-sky-100 text-sky-700',
    label: 'text-sky-700',
    icon: Church,
  },
  Colleges: {
    wrap: 'border-violet-100 from-violet-50 to-white',
    iconWrap: 'bg-violet-100 text-violet-700',
    label: 'text-violet-700',
    icon: GraduationCap,
  },
  Schools: {
    wrap: 'border-emerald-100 from-emerald-50 to-white',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    label: 'text-emerald-700',
    icon: BookOpen,
  },
  'Higher Secondary': {
    wrap: 'border-orange-100 from-orange-50 to-white',
    iconWrap: 'bg-orange-100 text-orange-600',
    label: 'text-orange-600',
    icon: School,
  },
};

function bucket(industry: string) {
  const i = industry.toLowerCase();
  if (i.includes('diocese') || i.includes('religious')) return 'Diocese / Religious';
  if (i.includes('higher')) return 'Higher Secondary';
  if (i.includes('college')) return 'Colleges';
  if (i.includes('school')) return 'Schools';
  return industry;
}

export function FeaturedProjectsSection({
  projects,
  hideIntro = false,
}: {
  projects: Project[];
  hideIntro?: boolean;
}) {
  const list = projects.length ? projects : FALLBACK_PROJECTS;
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const visible = useMemo(
    () => (filter === 'All' ? list : list.filter((p) => bucket(p.industry) === filter)),
    [filter, list],
  );

  return (
    <section
      id="work"
      className="relative overflow-hidden bg-gradient-to-b from-white via-sky-50/40 to-white py-16 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        {!hideIntro ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-600">
                — Our work —
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
                Featured <span className="text-blue-600">projects</span>
              </h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Work trusted by educational institutions across Tamil Nadu, Meghalaya and India —
                taken from published client references.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-sky-600" />
                <span>
                  <span className="block font-bold text-slate-900">{list.length}</span>
                  <span className="text-xs">Published projects</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-600" />
                <span>
                  <span className="block font-bold text-slate-900">{COMPANY.stats[1].value}</span>
                  <span className="text-xs">{COMPANY.stats[1].label}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <span>
                  <span className="block font-bold text-slate-900">{COMPANY.stats[0].value}</span>
                  <span className="text-xs">{COMPANY.stats[0].label}</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                <span>
                  <span className="block font-bold text-slate-900">Long-term</span>
                  <span className="text-xs">Partnerships</span>
                </span>
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition',
                  filter === item
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {item}
              </button>
            ))}
          </div>
          {!hideIntro ? (
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm"
            >
              View all projects <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((project) => {
            const group = bucket(project.industry);
            const theme = THEMES[group] ?? {
              wrap: 'border-slate-200 from-slate-50 to-white',
              iconWrap: 'bg-slate-100 text-slate-700',
              label: 'text-blue-600',
              icon: Building2,
            };
            const Icon = theme.icon;
            const href = project.websiteUrl ?? `/portfolio`;
            return (
              <article
                key={project.id}
                className={cn(
                  'relative overflow-hidden rounded-[26px] border bg-gradient-to-br p-6 shadow-sm',
                  theme.wrap,
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                      theme.iconWrap,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-[11px] font-bold uppercase tracking-[0.16em]',
                        theme.label,
                      )}
                    >
                      {group}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold leading-snug text-slate-900">
                      {project.clientName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{project.description}</p>
                    <a
                      href={href}
                      target={project.websiteUrl ? '_blank' : undefined}
                      rel={project.websiteUrl ? 'noreferrer' : undefined}
                      className={cn(
                        'mt-4 inline-flex items-center gap-1 text-sm font-semibold',
                        theme.label,
                      )}
                    >
                      View project <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                  <a
                    href={href}
                    target={project.websiteUrl ? '_blank' : undefined}
                    rel={project.websiteUrl ? 'noreferrer' : undefined}
                    aria-label={`Open ${project.clientName}`}
                    className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white text-slate-500 shadow-sm hover:text-blue-600"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {!visible.length ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            No published projects in this category yet.
          </p>
        ) : null}

        <p className="mt-10 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          — Empowering education through technology —
        </p>
      </div>
    </section>
  );
}
