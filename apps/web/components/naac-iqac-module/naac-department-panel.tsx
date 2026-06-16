'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  createNaacDepartmentSubmission,
  reviewNaacDepartmentSubmission,
  submitNaacDepartmentDraft,
} from '@/services/naac-iqac';
import type { NaacDepartmentSubmission } from '@/types/naac-iqac';
import { apiErrorMessage } from '@/utils/api-error';

type DeptDashboard = {
  scope?: {
    scoped: boolean;
    departmentIds: string[];
    primaryDepartmentId?: string;
    isHod: boolean;
  };
  departments?: Array<{ id: string; name: string; code: string }>;
  submissions?: NaacDepartmentSubmission[];
  pendingDepartments?: Array<{ id: string; name: string; code: string }>;
  submittedCount?: number;
  totalDepartments?: number;
};

const statusTone: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

export function NaacDepartmentPanel({
  data,
  canReview = false,
}: {
  data?: DeptDashboard;
  canReview?: boolean;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [departmentId, setDepartmentId] = useState(data?.scope?.primaryDepartmentId ?? '');
  const [academicYear, setAcademicYear] = useState('2025-26');
  const [submissionType, setSubmissionType] = useState('activities');
  const [notes, setNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const departments = data?.departments ?? [];
  const submissions = data?.submissions ?? [];

  const createMut = useMutation({
    mutationFn: (submit: boolean) =>
      createNaacDepartmentSubmission({
        departmentId: departmentId || departments[0]?.id || '',
        academicYear,
        submissionType,
        payload: { notes },
        submit,
      }),
    onSuccess: () => {
      setNotes('');
      setError('');
      void qc.invalidateQueries({ queryKey: ['naac-dept'] });
    },
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => submitNaacDepartmentDraft(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['naac-dept'] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      reviewNaacDepartmentSubmission(id, {
        status,
        reviewNotes: reviewNotes[id],
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['naac-dept'] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const deptName = (id: string) => departments.find((d) => d.id === id)?.code ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      {data?.scope?.scoped ? (
        <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30">
          {data.scope.isHod ? 'HOD view' : 'Department view'} — showing {departments.length}{' '}
          department{departments.length === 1 ? '' : 's'} in your scope.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Department NAAC submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {data?.submittedCount ?? 0} of {data?.totalDepartments ?? 0} departments submitted ·{' '}
            {(data?.pendingDepartments ?? []).length} pending
          </p>
          {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Department</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={departmentId || departments[0]?.id || ''}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Academic year</Label>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>
            <div>
              <Label>Submission type</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value)}
              >
                <option value="activities">Activities</option>
                <option value="research">Research</option>
                <option value="extension">Extension</option>
                <option value="best_practices">Best practices</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Summary / notes</Label>
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Department activities, outcomes, evidence references"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate(false)}
            >
              Save draft
            </Button>
            <Button disabled={createMut.isPending} onClick={() => createMut.mutate(true)}>
              Submit to IQAC
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Dept</th>
              <th className="px-3 py-2 text-left">Year</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              {canReview ? <th className="px-3 py-2 text-left">Review</th> : null}
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={canReview ? 6 : 5} className="px-3 py-4 text-muted-foreground">
                  No submissions yet.
                </td>
              </tr>
            ) : (
              submissions.map((s) => (
                <tr key={s.id} className="border-t align-top">
                  <td className="px-3 py-2">{deptName(s.departmentId)}</td>
                  <td className="px-3 py-2">{s.academicYear}</td>
                  <td className="px-3 py-2">{s.submissionType}</td>
                  <td className="px-3 py-2">
                    <Badge className={statusTone[s.status] ?? ''}>{s.status}</Badge>
                  </td>
                  {canReview ? (
                    <td className="px-3 py-2">
                      {s.status === 'SUBMITTED' ? (
                        <Input
                          placeholder="Review notes"
                          value={reviewNotes[s.id] ?? ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                        />
                      ) : (
                        String((s.payload as { reviewNotes?: string })?.reviewNotes ?? '—')
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 space-x-1">
                    {s.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submitMut.isPending}
                        onClick={() => submitMut.mutate(s.id)}
                      >
                        Submit
                      </Button>
                    ) : null}
                    {canReview && s.status === 'SUBMITTED' ? (
                      <>
                        <Button
                          size="sm"
                          disabled={reviewMut.isPending}
                          onClick={() => reviewMut.mutate({ id: s.id, status: 'APPROVED' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={reviewMut.isPending}
                          onClick={() => reviewMut.mutate({ id: s.id, status: 'REJECTED' })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
