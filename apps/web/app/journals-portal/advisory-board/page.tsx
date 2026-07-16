'use client';

import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalBoard } from '@/services/journals-portal';

export default function AdvisoryBoardPage() {
  const boardQ = useQuery({
    queryKey: ['journal-board', 'advisory'],
    queryFn: () => fetchJournalBoard({ scope: 'advisory' }),
  });
  const members = boardQ.data ?? [];

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">People</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Advisory Board</h1>
        {boardQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : members.length === 0 ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">
            Advisory board members will be listed here.
          </p>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {members.map((m) => (
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
                {m.country ? <p className="mt-1 text-xs text-[#0A2342]/45">{m.country}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
