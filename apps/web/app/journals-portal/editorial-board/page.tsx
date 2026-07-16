'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
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
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">People</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Editorial Board</h1>
        <p className="mt-2 text-sm text-[#0A2342]/65">
          For the Advisory Board, see the{' '}
          <a href="/journals-portal/advisory-board" className="underline">
            Advisory Board
          </a>{' '}
          page.
        </p>
        {boardQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Board members will be listed here.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {groups.map((type) => {
              const rows = members.filter((m) => m.boardType === type);
              if (!rows.length) return null;
              return (
                <section key={type}>
                  <h2 className="border-b border-[#F4B400]/40 pb-2 font-serif text-xl font-semibold text-[#0A2342]">
                    {TYPE_LABELS[type]}
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {rows.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[#0A2342]/10 bg-white p-4 shadow-sm"
                      >
                        <p className="font-semibold text-[#0A2342]">{m.fullName}</p>
                        <p className="text-xs text-[#0A2342]/55">{m.roleTitle}</p>
                        {m.department ? (
                          <p className="mt-1 text-sm text-[#0A2342]/70">{m.department}</p>
                        ) : null}
                        {m.institution ? (
                          <p className="text-sm text-[#0A2342]/70">{m.institution}</p>
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
