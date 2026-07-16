'use client';

import { useQuery } from '@tanstack/react-query';
import { FadeUp } from '@/components/journals-portal/home/home-motion';
import { fetchJournalPortalInfo } from '@/services/journals-portal';
import { cn } from '@/utils/cn';

type Props = {
  eyebrow: string;
  title: string;
  /** Override the default Transient journal subtitle line. */
  subtitle?: string | null;
  /** Hide the auto journal subtitle. */
  hideSubtitle?: boolean;
  actions?: React.ReactNode;
  className?: string;
};

export function JournalPageHero({
  eyebrow,
  title,
  subtitle,
  hideSubtitle = false,
  actions,
  className,
}: Props) {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const journal = infoQ.data?.journal;
  const name = journal?.name || 'Transient';
  const tagline = journal?.tagline || 'A Journal of Natural Sciences and Allied Subjects';
  const issn = journal?.issn || '2250-0650';
  const institution = journal?.institution || 'Don Bosco College, Tura';
  const defaultSubtitle = `${name} — ${tagline} (peer reviewed) · ISSN ${issn} · ${institution}`;
  const line = hideSubtitle ? null : (subtitle ?? defaultSubtitle);

  return (
    <section
      className={cn('border-b border-[var(--jp-border)] bg-[var(--jp-navy)] text-white', className)}
    >
      <div className="mx-auto max-w-5xl px-4 py-14 lg:px-6 lg:py-16">
        <FadeUp>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E4BC3A]">
            {eyebrow}
          </p>
          <h1 className="jp-serif mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {line ? (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/75">{line}</p>
          ) : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </FadeUp>
      </div>
    </section>
  );
}
