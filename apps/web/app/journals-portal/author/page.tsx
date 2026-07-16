'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
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
      <JournalPageHero
        eyebrow="Author portal"
        title="My submissions"
        subtitle={
          session?.accessToken
            ? `Signed in as ${authorName}${authorEmail ? ` · ${authorEmail}` : ''}`
            : undefined
        }
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/journals-portal/reviewer">Reviewer desk</Link>
            </Button>
            <Button asChild className="bg-[#C9A227] text-[#0B1F3A] hover:bg-[#C9A227]/90">
              <Link href="/journals-portal/author/submissions/new">New submission</Link>
            </Button>
          </>
        }
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {listQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : (listQ.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--jp-muted)]">
            No submissions yet. Start a new manuscript submission.
          </p>
        ) : (
          <ul className="space-y-3">
            {(listQ.data ?? []).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--jp-border)] bg-white p-4 shadow-sm"
              >
                <div>
                  <Link
                    href={`/journals-portal/author/submissions/${s.id}`}
                    className="jp-serif text-lg font-semibold text-[var(--jp-ink)] hover:underline"
                  >
                    {s.title}
                  </Link>
                  <p className="text-xs text-[var(--jp-muted)]">
                    Status: {s.status}
                    {s.currentRound ? ` · Round ${s.currentRound}` : ''}
                  </p>
                </div>
                <Link
                  href={`/journals-portal/author/submissions/${s.id}`}
                  className="text-sm font-medium text-[var(--jp-ink)]"
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
