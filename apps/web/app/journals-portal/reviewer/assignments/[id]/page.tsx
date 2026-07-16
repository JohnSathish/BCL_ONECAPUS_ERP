'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import {
  acceptReviewAssignment,
  declineReviewAssignment,
  fetchMyReviewAssignment,
  submitReviewReport,
} from '@/services/journals-portal';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { Button } from '@/components/ui/button';

export default function ReviewAssignmentPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const token = search.get('token') || undefined;
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const qc = useQueryClient();
  const [recommendation, setRecommendation] = useState('MINOR_REVISION');
  const [commentsToAuthor, setCommentsToAuthor] = useState('');
  const [commentsToEditor, setCommentsToEditor] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [coiNotes, setCoiNotes] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!session?.accessToken) router.replace('/journals-portal/login');
  }, [session, router]);

  const q = useQuery({
    queryKey: ['journal-review-assignment', params.id],
    queryFn: () => fetchMyReviewAssignment(params.id),
    enabled: Boolean(session?.accessToken && params.id),
  });

  const accept = useMutation({
    mutationFn: () =>
      acceptReviewAssignment(params.id, {
        token,
        conflictOfInterest: hasConflict,
        conflictOfInterestNotes: hasConflict ? coiNotes : undefined,
      }),
    onSuccess: () => {
      setMsg('Invitation accepted.');
      void qc.invalidateQueries({ queryKey: ['journal-review-assignment', params.id] });
      void qc.invalidateQueries({ queryKey: ['journal-review-assignments'] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Accept failed')),
  });

  const decline = useMutation({
    mutationFn: () => declineReviewAssignment(params.id, token),
    onSuccess: () => {
      setMsg('Invitation declined.');
      void qc.invalidateQueries({ queryKey: ['journal-review-assignment', params.id] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Decline failed')),
  });

  const report = useMutation({
    mutationFn: () =>
      submitReviewReport(params.id, {
        recommendation,
        commentsToAuthor,
        commentsToEditor,
      }),
    onSuccess: () => {
      setMsg('Review submitted.');
      void qc.invalidateQueries({ queryKey: ['journal-review-assignment', params.id] });
    },
    onError: (e) => setMsg(apiErrorMessage(e, 'Report failed')),
  });

  const a = q.data as
    | {
        status: string;
        dueAt?: string | null;
        conflictOfInterest?: boolean | null;
        conflictOfInterestNotes?: string | null;
        report?: unknown;
        round?: { submission?: { title?: string; abstract?: string | null } };
      }
    | undefined;

  const overdue =
    a?.dueAt &&
    !['COMPLETED', 'DECLINED'].includes(a.status) &&
    new Date(a.dueAt).getTime() < Date.now();

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {q.isLoading ? (
          <p className="text-sm">Loading…</p>
        ) : !a ? (
          <p className="text-sm text-red-700">Assignment not found.</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
              {a.status}
              {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleDateString()}` : ''}
              {overdue ? ' · OVERDUE' : ''}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">
              {a.round?.submission?.title || 'Review assignment'}
            </h1>
            {a.round?.submission?.abstract ? (
              <p className="mt-4 text-sm text-[#0A2342]/75">{a.round.submission.abstract}</p>
            ) : null}

            {a.status === 'INVITED' ? (
              <div className="mt-6 space-y-3 rounded-lg border border-[#0A2342]/10 p-4">
                <p className="text-sm font-medium text-[#0A2342]">
                  Conflict of interest declaration (required to accept)
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={hasConflict}
                    onChange={(e) => setHasConflict(e.target.checked)}
                  />
                  <span>I have a conflict of interest with this manuscript</span>
                </label>
                {hasConflict ? (
                  <textarea
                    className="min-h-[60px] w-full rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="Describe the conflict"
                    value={coiNotes}
                    onChange={(e) => setCoiNotes(e.target.value)}
                  />
                ) : (
                  <p className="text-xs text-[#0A2342]/60">
                    Leave unchecked to confirm you have no conflict of interest.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => accept.mutate()}
                    disabled={accept.isPending || (hasConflict && !coiNotes.trim())}
                  >
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => decline.mutate()}>
                    Decline
                  </Button>
                </div>
              </div>
            ) : null}

            {a.conflictOfInterest != null ? (
              <p className="mt-4 text-xs text-[#0A2342]/60">
                COI declared: {a.conflictOfInterest ? 'Yes' : 'No'}
                {a.conflictOfInterestNotes ? ` — ${a.conflictOfInterestNotes}` : ''}
              </p>
            ) : null}

            {['ACCEPTED', 'INVITED'].includes(a.status) && !a.report ? (
              <div className="mt-8 space-y-3 rounded-lg border border-[#0A2342]/10 p-4">
                <label className="block text-sm">
                  Recommendation
                  <select
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                  >
                    <option value="ACCEPT">Accept</option>
                    <option value="MINOR_REVISION">Minor revision</option>
                    <option value="MAJOR_REVISION">Major revision</option>
                    <option value="REJECT">Reject</option>
                  </select>
                </label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Comments to author"
                  value={commentsToAuthor}
                  onChange={(e) => setCommentsToAuthor(e.target.value)}
                />
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Comments to editor"
                  value={commentsToEditor}
                  onChange={(e) => setCommentsToEditor(e.target.value)}
                />
                <Button onClick={() => report.mutate()} disabled={report.isPending}>
                  Submit review
                </Button>
              </div>
            ) : null}

            {msg ? <p className="mt-4 text-sm text-emerald-800">{msg}</p> : null}
          </>
        )}
      </div>
    </JournalPublicShell>
  );
}
