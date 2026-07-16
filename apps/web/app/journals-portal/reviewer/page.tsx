'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchMyReviewAssignments } from '@/services/journals-portal';
import { useAuthStore } from '@/store/auth-store';

type AssignmentRow = {
  id: string;
  status: string;
  dueAt?: string | null;
  conflictOfInterest?: boolean | null;
  round: {
    submission: { title: string; id: string };
  };
};

function isOverdue(a: AssignmentRow) {
  if (!a.dueAt) return false;
  if (['COMPLETED', 'DECLINED'].includes(a.status)) return false;
  return new Date(a.dueAt).getTime() < Date.now();
}

export default function ReviewerDashboardPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session?.accessToken) router.replace('/journals-portal/login');
  }, [session, router]);

  const listQ = useQuery({
    queryKey: ['journal-review-assignments'],
    queryFn: fetchMyReviewAssignments,
    enabled: Boolean(session?.accessToken),
  });

  const rows = (listQ.data as AssignmentRow[]) ?? [];
  const stats = useMemo(() => {
    const pending = rows.filter((r) => ['INVITED', 'ACCEPTED'].includes(r.status)).length;
    const completed = rows.filter((r) => r.status === 'COMPLETED').length;
    const overdue = rows.filter(isOverdue).length;
    return { total: rows.length, pending, completed, overdue };
  }, [rows]);

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Reviewer portal"
        title="My assignments"
        subtitle="Manage peer-review invitations and reports."
        actions={
          <Link
            href="/journals-portal/author"
            className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/35 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
          >
            Author desk
          </Link>
        }
      />
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Completed', value: stats.completed },
            { label: 'Overdue', value: stats.overdue },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-paper)] px-3 py-3 text-center"
            >
              <p className="text-2xl font-semibold text-[var(--jp-ink)]">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-[var(--jp-muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        {listQ.isLoading ? (
          <p className="mt-8 text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-sm text-[var(--jp-muted)]">No review invitations yet.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex justify-between gap-4 rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-4"
              >
                <div>
                  <Link
                    href={`/journals-portal/reviewer/assignments/${a.id}`}
                    className="jp-serif text-lg font-semibold text-[var(--jp-ink)] hover:underline"
                  >
                    {a.round?.submission?.title || 'Submission'}
                  </Link>
                  <p className="text-xs text-[var(--jp-muted)]">
                    Status: {a.status}
                    {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleDateString()}` : ''}
                    {isOverdue(a) ? (
                      <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                        Overdue
                      </span>
                    ) : null}
                  </p>
                </div>
                <Link
                  href={`/journals-portal/reviewer/assignments/${a.id}`}
                  className="text-sm text-[var(--jp-ink)]"
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
