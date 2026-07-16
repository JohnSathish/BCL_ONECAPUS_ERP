'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJournalPortalInfo } from '@/services/journals-portal';
import { HomeHero } from './home/home-hero';
import { HomeQuickAccess } from './home/home-quick-access';
import { HomeAbout } from './home/home-about';
import { HomeCurrentIssue } from './home/home-current-issue';
import { HomeWhyPublish } from './home/home-why-publish';
import { HomeBoard } from './home/home-board';
import { HomeArticles } from './home/home-articles';
import { HomeAnnouncements } from './home/home-announcements';
import { HomeFaq } from './home/home-faq';
import { HomeCta } from './home/home-cta';

export function JournalHomePage() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
  });
  const data = infoQ.data;
  const journal = data?.journal;
  const issue = data?.currentIssue ?? null;
  const metrics = data?.metrics;
  const banner = journal?.bannerUrl || '/branding/transient-science-hero.png';
  const cover = issue?.coverUrl || banner;

  if (infoQ.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-sm text-[var(--jp-muted)]">
        Loading journal…
      </div>
    );
  }

  if (infoQ.isError || !journal) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-sm text-red-700">
        Unable to load journal portal. Ensure the journal is seeded and the host/slug is correct.
      </div>
    );
  }

  const articles =
    (data?.topViewed?.length ? data.topViewed : null) ||
    issue?.articles ||
    data?.topDownloaded ||
    [];

  return (
    <div>
      <div className="relative">
        <HomeHero journal={journal} issue={issue} banner={banner} cover={cover} />
        <HomeQuickAccess />
      </div>
      <HomeAbout journal={journal} />
      <HomeCurrentIssue
        issue={issue}
        cover={cover}
        volumeCount={metrics?.volumeCount ?? 0}
        articleCount={metrics?.articleCount ?? 0}
        authorCount={metrics?.authorCount ?? metrics?.articleCount ?? 0}
      />
      <HomeWhyPublish />
      <HomeBoard members={data?.boardPreview ?? []} />
      <HomeAnnouncements
        announcements={data?.announcements ?? []}
        featuredImageUrl={journal.homeAnnouncementsImageUrl}
        featuredHeadline={journal.homeAnnouncementsHeadline}
        featuredSubtext={journal.homeAnnouncementsSubtext}
      />
      <HomeArticles articles={articles} />
      <HomeFaq />
      <HomeCta />
    </div>
  );
}
