'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchMySubmissions, fetchJournalPortalMe } from '@/services/journals-portal';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';

function resolveAuthorLabel(displayName?: string | null, email?: string | null) {
  const name = displayName?.trim() || '';
  const mail = email?.trim() || '';
  if (name && !name.includes('@') && name.toLowerCase() !== mail.toLowerCase()) {
    return name;
  }
  if (mail.includes('@')) {
    const local = mail.split('@')[0] || 'Author';
    return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name || 'Author';
}

export default function AuthorDashboardPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session?.accessToken) {
      router.replace('/journals-portal/login');
    }
  }, [session, router]);

  const meQ = useQuery({
    queryKey: ['journal-me'],
    queryFn: fetchJournalPortalMe,
    enabled: Boolean(session?.accessToken),
  });

  const listQ = useQuery({
    queryKey: ['journal-my-submissions'],
    queryFn: fetchMySubmissions,
    enabled: Boolean(session?.accessToken),
  });

  const authorName = resolveAuthorLabel(
    meQ.data?.displayName || meQ.data?.profile?.displayName || session?.user?.displayName,
    meQ.data?.email || session?.user?.email,
  );
  const authorEmail = meQ.data?.email || session?.user?.email || '';

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
              Author portal
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-[#0A2342]">
              My submissions
            </h1>
            {session?.accessToken ? (
              <p className="mt-1 text-sm text-[#0A2342]/65">
                Signed in as <span className="font-medium text-[#0A2342]">{authorName}</span>
                {authorEmail ? <span className="text-[#0A2342]/50"> · {authorEmail}</span> : null}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/journals-portal/reviewer">Reviewer desk</Link>
            </Button>
            <Button asChild className="bg-[#F4B400] text-[#0A2342] hover:bg-[#F4B400]/90">
              <Link href="/journals-portal/author/submissions/new">New submission</Link>
            </Button>
          </div>
        </div>

        {listQ.isLoading ? (
          <p className="mt-8 text-sm text-[#0A2342]/60">Loading…</p>
        ) : (listQ.data ?? []).length === 0 ? (
          <p className="mt-8 text-sm text-[#0A2342]/60">
            No submissions yet. Start a new manuscript submission.
          </p>
        ) : (
          <ul className="mt-8 space-y-3">
            {(listQ.data ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#0A2342]/10 bg-white p-4 shadow-sm"
              >
                <div>
                  <Link
                    href={`/journals-portal/author/submissions/${s.id}`}
                    className="font-serif text-lg font-semibold text-[#0A2342] hover:underline"
                  >
                    {s.title}
                  </Link>
                  <p className="text-xs text-[#0A2342]/55">
                    Status: {s.status}
                    {s.currentRound ? ` · Round ${s.currentRound}` : ''}
                  </p>
                </div>
                <Link
                  href={`/journals-portal/author/submissions/${s.id}`}
                  className="text-sm font-medium text-[#0A2342]"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
