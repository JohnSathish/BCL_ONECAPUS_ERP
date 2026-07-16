'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalBoard } from '@/services/journals-portal';

const TYPE_LABELS: Record<string, string> = {
  CHIEF_EDITOR: 'Chief Editor',
  MANAGING: 'Managing Editors',
  ASSOCIATE: 'Associate Editors',
  COMMITTEE: 'Committee',
  EDITORIAL: 'Editorial Board',
  BOARD: 'Editorial Board',
  CHIEF_PATRON: 'Chief Patron',
  PATRON: 'Patron',
  PUBLISHER: 'Publisher',
  OFFICE: 'Office',
};

export default function EditorialBoardPage() {
  const boardQ = useQuery({
    queryKey: ['journal-board', 'editorial'],
    queryFn: () => fetchJournalBoard({ scope: 'editorial' }),
  });
  const members = boardQ.data ?? [];
  const groups = Object.keys(TYPE_LABELS);

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="People"
        title="Editorial Board"
        subtitle="Meet the editors who steward Transient’s peer-reviewed publishing process."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-sm text-[var(--jp-muted)]">
          For the Advisory Board, see the{' '}
          <a href="/journals-portal/advisory-board" className="underline">
            Advisory Board
          </a>{' '}
          page.
        </p>
        {boardQ.isLoading ? (
          <p className="mt-6 text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-6 text-sm text-[var(--jp-muted)]">Board members will be listed here.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {groups.map((type) => {
              const rows = members.filter((m) => m.boardType === type);
              if (!rows.length) return null;
              return (
                <section key={type}>
                  <h2 className="border-b border-[rgba(201,162,39,0.4)] pb-2 jp-serif text-xl font-semibold text-[var(--jp-ink)]">
                    {TYPE_LABELS[type]}
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {rows.map((m) => (
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
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </JournalPublicShell>
  );
}
