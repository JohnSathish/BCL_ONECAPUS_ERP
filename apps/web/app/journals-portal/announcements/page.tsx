'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

export default function AnnouncementsPage() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
  });
  const announcements = infoQ.data?.announcements ?? [];

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">News</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Announcements</h1>
        {infoQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">No announcements at this time.</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {announcements.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[#0A2342]/10 bg-white p-5 shadow-sm"
              >
                <h2 className="font-serif text-lg font-semibold text-[#0A2342]">{a.title}</h2>
                {a.bodyHtml ? (
                  <div
                    className="prose prose-sm mt-2 max-w-none text-[#0A2342]/80"
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
