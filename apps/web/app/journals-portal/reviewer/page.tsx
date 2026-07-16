'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
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
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
          Reviewer portal
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-[#0A2342]">My assignments</h1>
        <p className="mt-2 text-sm">
          <Link href="/journals-portal/author" className="underline">
            Author desk
          </Link>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Completed', value: stats.completed },
            { label: 'Overdue', value: stats.overdue },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[#0A2342]/10 bg-[#f7f8fa] px-3 py-3 text-center"
            >
              <p className="text-2xl font-semibold text-[#0A2342]">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-[#0A2342]/55">{s.label}</p>
            </div>
          ))}
        </div>

        {listQ.isLoading ? (
          <p className="mt-8 text-sm text-[#0A2342]/60">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 text-sm text-[#0A2342]/60">No review invitations yet.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex justify-between gap-4 rounded-lg border border-[#0A2342]/10 p-4"
              >
                <div>
                  <Link
                    href={`/journals-portal/reviewer/assignments/${a.id}`}
                    className="font-serif text-lg font-semibold hover:underline"
                  >
                    {a.round?.submission?.title || 'Submission'}
                  </Link>
                  <p className="text-xs text-[#0A2342]/55">
                    Status: {a.status}
                    {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleDateString()}` : ''}
                    {isOverdue(a) ? (
                      <span className="ml-2 font-semibold text-red-700">Overdue</span>
                    ) : null}
                  </p>
                </div>
                <Link href={`/journals-portal/reviewer/assignments/${a.id}`} className="text-sm">
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
