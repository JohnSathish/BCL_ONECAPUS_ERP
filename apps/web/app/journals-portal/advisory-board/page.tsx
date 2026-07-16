'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalBoard } from '@/services/journals-portal';

export default function AdvisoryBoardPage() {
  const boardQ = useQuery({
    queryKey: ['journal-board', 'advisory'],
    queryFn: () => fetchJournalBoard({ scope: 'advisory' }),
  });
  const members = boardQ.data ?? [];

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="People"
        title="Advisory Board"
        subtitle="International advisors guiding Transient’s scholarly direction."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {boardQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-[var(--jp-muted)]">
            Advisory board members will be listed here.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-4 shadow-sm"
              >
                <p className="font-semibold text-[var(--jp-ink)]">{m.fullName}</p>
                <p className="text-xs text-[var(--jp-muted)]">{m.roleTitle}</p>
                {m.department ? (
                  <p className="mt-1 text-sm text-[var(--jp-ink)]/70">{m.department}</p>
                ) : null}
                {m.institution ? (
                  <p className="text-sm text-[var(--jp-ink)]/70">{m.institution}</p>
                ) : null}
                {m.country ? (
                  <p className="mt-1 text-xs text-[var(--jp-muted)]">{m.country}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
