'use client';

import Link from 'next/link';
import { BookOpen, FileText, Users } from 'lucide-react';
import type { JournalIssue } from '@/services/journals-portal';
import { JournalAnimatedCounter } from '@/components/journals-portal/journal-animated-counter';
import { FadeUp } from './home-motion';

type Props = {
  issue: JournalIssue | null;
  cover: string;
  volumeCount: number;
  articleCount: number;
  authorCount: number;
};

export function HomeCurrentIssue({ issue, cover, volumeCount, articleCount, authorCount }: Props) {
  const stats = [
    {
      icon: BookOpen,
      label: 'Volumes Published',
      node: (
        <JournalAnimatedCounter
          value={Math.max(volumeCount, issue?.volume.volumeNumber ?? 1)}
          suffix="+"
          className="jp-serif text-2xl font-semibold tracking-tight sm:text-3xl"
        />
      ),
    },
    {
      icon: FileText,
      label: 'Articles Published',
      node: (
        <JournalAnimatedCounter
          value={Math.max(articleCount, 1)}
          suffix="+"
          className="jp-serif text-2xl font-semibold tracking-tight sm:text-3xl"
        />
      ),
    },
    {
      icon: Users,
      label: 'Authors Worldwide',
      node: (
        <JournalAnimatedCounter
          value={Math.max(authorCount, articleCount, 1)}
          suffix="+"
          className="jp-serif text-2xl font-semibold tracking-tight sm:text-3xl"
        />
      ),
    },
  ];

  return (
    <section className="bg-[var(--jp-paper)] px-4 py-16 lg:px-6 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[220px_1fr_240px] lg:gap-12">
        <FadeUp className="flex justify-center lg:justify-start">
          <div className="jp-cover w-[180px] overflow-hidden rounded-sm bg-[var(--jp-card)] sm:w-[200px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={issue?.title || 'Current issue cover'}
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
        </FadeUp>

        <FadeUp delay={0.06} className="text-center lg:text-left">
          <p className="jp-eyebrow">Current Issue</p>
          {issue ? (
            <>
              <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight sm:text-[2.35rem]">
                Volume {issue.volume.volumeNumber} | {issue.volume.year}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--jp-muted)] lg:mx-0 mx-auto">
                {issue.summary ||
                  issue.title ||
                  `Issue ${issue.issueNumber} — browse the latest peer-reviewed contributions published in Transient.`}
              </p>
            </>
          ) : (
            <>
              <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight">Coming soon</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--jp-muted)] lg:mx-0 mx-auto">
                The current issue will appear here when published. Browse archives for past volumes.
              </p>
            </>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/journals-portal/current-issue"
              className="jp-btn jp-btn-gold rounded-sm px-5 py-2.5"
            >
              View Issue
            </Link>
            <Link
              href="/journals-portal/archives"
              className="jp-btn rounded-sm border border-[var(--jp-gold)] bg-transparent px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--jp-navy)] dark:text-[var(--jp-ink)]"
            >
              All Issues
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.1} className="flex flex-col gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="jp-lift flex items-center gap-4 rounded-md border border-[var(--jp-border)] bg-[var(--jp-card)] px-4 py-4 dark:bg-[var(--jp-card)]"
              >
                <span className="shrink-0 text-[var(--jp-gold)]">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0">
                  <div className="text-[var(--jp-ink)]">{s.node}</div>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--jp-muted)]">
                    {s.label}
                  </p>
                </div>
              </div>
            );
          })}
        </FadeUp>
      </div>
    </section>
  );
}
