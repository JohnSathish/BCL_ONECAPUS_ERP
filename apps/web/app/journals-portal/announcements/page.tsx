'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

export default function AnnouncementsPage() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
  });
  const announcements = infoQ.data?.announcements ?? [];

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="News"
        title="Announcements"
        subtitle="Calls, deadlines, and editorial notices from Transient."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        {infoQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-[var(--jp-muted)]">No announcements at this time.</p>
        ) : (
          <ul className="space-y-4">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[var(--jp-border)] bg-white p-5 shadow-sm"
              >
                <h2 className="jp-serif text-lg font-semibold text-[var(--jp-ink)]">{a.title}</h2>
                {a.bodyHtml ? (
                  <div
                    className="prose prose-sm mt-2 max-w-none text-[var(--jp-ink)]/80"
                    dangerouslySetInnerHTML={{ __html: a.bodyHtml }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
