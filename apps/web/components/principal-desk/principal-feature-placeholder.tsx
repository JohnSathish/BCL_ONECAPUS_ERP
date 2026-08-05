'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Construction } from 'lucide-react';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { cn } from '@/utils/cn';

export type PrincipalRelatedLink = {
  href: string;
  label: string;
  description?: string;
};

export function PrincipalFeaturePlaceholder({
  title,
  subtitle,
  description,
  icon: Icon = Construction,
  related = [],
  status = 'Rolling out',
}: {
  title: string;
  subtitle?: string;
  description: string;
  icon?: LucideIcon;
  related?: PrincipalRelatedLink[];
  status?: string;
}) {
  return (
    <PrincipalDeskShell title={title} subtitle={subtitle}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                {status}
              </span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-muted-foreground">
              {description}
            </p>
            {related.length ? (
              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Related tools available now
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {related.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          'group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm transition',
                          'hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-border dark:bg-muted/40 dark:hover:border-indigo-500/40',
                        )}
                      >
                        <span>
                          <span className="block font-semibold text-slate-900 dark:text-foreground">
                            {link.label}
                          </span>
                          {link.description ? (
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {link.description}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-indigo-600 opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PrincipalDeskShell>
  );
}
