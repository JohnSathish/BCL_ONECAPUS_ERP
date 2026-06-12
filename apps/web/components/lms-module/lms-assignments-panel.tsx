'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import {
  closeLmsAssignment,
  createLmsAssignment,
  evaluateLmsSubmission,
  fetchLmsAssignmentSubmissions,
  fetchLmsAssignments,
  publishLmsAssignment,
  returnLmsSubmission,
  submitLmsAssignment,
  type LmsAssignment,
} from '@/services/lms';

type Props = {
  workspaceId: string;
  viewerRole: 'admin' | 'faculty' | 'student';
};

export function LmsAssignmentsPanel({ workspaceId, viewerRole }: Props) {
  const qc = useQueryClient();
  const isStudent = viewerRole === 'student';
  const canManage = !isStudent;

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submissionType, setSubmissionType] = useState('FILE');
  const [dueAt, setDueAt] = useState('');
  const [maxMarks, setMaxMarks] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  const [evalMarks, setEvalMarks] = useState('');
  const [evalFeedback, setEvalFeedback] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

  const assignments = useQuery({
    queryKey: ['lms', 'assignments', workspaceId],
    queryFn: () => withApiStartupRetry(() => fetchLmsAssignments(workspaceId)),
    retry: false,
  });

  const submissions = useQuery({
    queryKey: ['lms', 'assignment-submissions', selectedAssignmentId],
    queryFn: () => withApiStartupRetry(() => fetchLmsAssignmentSubmissions(selectedAssignmentId!)),
    enabled: Boolean(selectedAssignmentId && canManage),
    retry: false,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createLmsAssignment(workspaceId, {
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        submissionType,
        dueAt: dueAt || undefined,
        maxMarks: maxMarks ? Number(maxMarks) : undefined,
        allowLateSubmission: false,
      } as Partial<LmsAssignment>),
    onSuccess: () => {
      setTitle('');
      setInstructions('');
      setDueAt('');
      setMaxMarks('');
      void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] });
    },
  });

  const publishMut = useMutation({
    mutationFn: (id: string) => publishLmsAssignment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] }),
  });

  const closeMut = useMutation({
    mutationFn: (id: string) => closeLmsAssignment(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] }),
  });

  const submitMut = useMutation({
    mutationFn: ({
      assignmentId,
      textContent,
      linkUrl,
      file,
    }: {
      assignmentId: string;
      textContent?: string;
      linkUrl?: string;
      file?: File | null;
    }) => {
      const form = new FormData();
      if (textContent?.trim()) form.append('textContent', textContent.trim());
      if (linkUrl?.trim()) form.append('linkUrl', linkUrl.trim());
      if (file) form.append('file', file);
      return submitLmsAssignment(assignmentId, form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] });
    },
  });

  const evaluateMut = useMutation({
    mutationFn: () =>
      evaluateLmsSubmission(activeSubmissionId!, {
        marksAwarded: evalMarks ? Number(evalMarks) : undefined,
        feedbackText: evalFeedback.trim() || undefined,
      }),
    onSuccess: () => {
      setActiveSubmissionId(null);
      setEvalMarks('');
      setEvalFeedback('');
      void submissions.refetch();
      void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] });
    },
  });

  const returnMut = useMutation({
    mutationFn: () => returnLmsSubmission(activeSubmissionId!, returnFeedback.trim()),
    onSuccess: () => {
      setActiveSubmissionId(null);
      setReturnFeedback('');
      void submissions.refetch();
      void qc.invalidateQueries({ queryKey: ['lms', 'assignments', workspaceId] });
    },
  });

  const list = assignments.data ?? [];

  return (
    <div className="space-y-4">
      {canManage ? (
        <CompactCard>
          <CompactCardHeader
            title="Create assignment"
            description="Draft assignments can be edited before publishing."
          />
          <CompactCardBody className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="asg-title">Title</Label>
              <Input id="asg-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="asg-type">Submission type</Label>
              <select
                id="asg-type"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value)}
              >
                <option value="FILE">File upload</option>
                <option value="TEXT">Text</option>
                <option value="LINK">Link</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="asg-instr">Instructions</Label>
              <textarea
                id="asg-instr"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="asg-due">Due date</Label>
              <Input
                id="asg-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asg-marks">Max marks</Label>
              <Input
                id="asg-marks"
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                size="sm"
                disabled={!title.trim() || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                Save draft
              </Button>
            </div>
          </CompactCardBody>
        </CompactCard>
      ) : null}

      {assignments.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading assignments…
        </div>
      ) : null}

      <div className="space-y-2">
        {list.map((a) => (
          <CompactCard key={a.id}>
            <CompactCardBody className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <ClipboardList className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.status} · {a.submissionType}
                      {a.dueAt ? ` · Due ${new Date(a.dueAt).toLocaleString()}` : ''}
                      {a.maxMarks != null ? ` · ${a.maxMarks} marks` : ''}
                    </p>
                    {a.instructions ? (
                      <p className="mt-1 text-sm text-muted-foreground">{a.instructions}</p>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    {a.status === 'DRAFT' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={publishMut.isPending}
                        onClick={() => publishMut.mutate(a.id)}
                      >
                        Publish
                      </Button>
                    ) : null}
                    {a.status === 'PUBLISHED' ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAssignmentId(a.id)}
                        >
                          Submissions ({a._count?.submissions ?? 0})
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={closeMut.isPending}
                          onClick={() => closeMut.mutate(a.id)}
                        >
                          Close
                        </Button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isStudent && a.status === 'PUBLISHED' ? (
                <StudentSubmitBlock
                  assignment={a}
                  onSubmit={(payload) => submitMut.mutate({ assignmentId: a.id, ...payload })}
                  isPending={submitMut.isPending}
                />
              ) : null}
            </CompactCardBody>
          </CompactCard>
        ))}
        {!assignments.isLoading && !list.length ? (
          <p className="text-sm text-muted-foreground">No assignments in this workspace yet.</p>
        ) : null}
      </div>

      {canManage && selectedAssignmentId ? (
        <CompactCard>
          <CompactCardHeader title="Submissions" />
          <CompactCardBody className="space-y-3">
            {(submissions.data ?? []).map((s) => (
              <div key={s.id} className="rounded-lg border px-3 py-2 text-sm">
                <p className="font-medium">
                  {s.student?.masterProfile?.fullName ?? s.student?.enrollmentNumber ?? s.id}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.status} · attempt {s.attemptNo}
                  </span>
                </p>
                {s.textContent ? <p className="mt-1 whitespace-pre-wrap">{s.textContent}</p> : null}
                {s.linkUrl ? (
                  <a
                    href={s.linkUrl}
                    className="mt-1 block text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.linkUrl}
                  </a>
                ) : null}
                {s.filePath ? (
                  <p className="mt-1 text-xs text-muted-foreground">File: {s.filePath}</p>
                ) : null}
                {s.feedback?.[0]?.feedbackText ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Latest feedback: {s.feedback[0].feedbackText}
                  </p>
                ) : null}
                {s.status === 'SUBMITTED' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveSubmissionId(s.id)}
                    >
                      Evaluate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveSubmissionId(s.id)}
                    >
                      Return for revision
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {!submissions.data?.length ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : null}
          </CompactCardBody>
        </CompactCard>
      ) : null}

      {canManage && activeSubmissionId ? (
        <CompactCard>
          <CompactCardHeader title="Review submission" />
          <CompactCardBody className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Marks awarded</Label>
              <Input
                type="number"
                value={evalMarks}
                onChange={(e) => setEvalMarks(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Feedback</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={evalFeedback}
                onChange={(e) => setEvalFeedback(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="button"
                size="sm"
                disabled={evaluateMut.isPending}
                onClick={() => evaluateMut.mutate()}
              >
                Mark evaluated
              </Button>
              <div className="flex flex-1 gap-2">
                <Input
                  placeholder="Return reason…"
                  value={returnFeedback}
                  onChange={(e) => setReturnFeedback(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!returnFeedback.trim() || returnMut.isPending}
                  onClick={() => returnMut.mutate()}
                >
                  Return
                </Button>
              </div>
            </div>
          </CompactCardBody>
        </CompactCard>
      ) : null}
    </div>
  );
}

function StudentSubmitBlock({
  assignment,
  onSubmit,
  isPending,
}: {
  assignment: LmsAssignment;
  onSubmit: (payload: { textContent?: string; linkUrl?: string; file?: File | null }) => void;
  isPending: boolean;
}) {
  const [submitText, setSubmitText] = useState('');
  const [submitLink, setSubmitLink] = useState('');
  const [submitFile, setSubmitFile] = useState<File | null>(null);

  const sub = assignment.mySubmission;
  const canSubmit = !sub || sub.status === 'RETURNED';

  if (sub?.status === 'SUBMITTED') {
    return <p className="text-sm text-muted-foreground">Submitted — awaiting faculty review.</p>;
  }
  if (sub?.status === 'EVALUATED') {
    const latest = sub.feedback?.[0];
    return (
      <p className="text-sm text-muted-foreground">
        Evaluated{latest?.marksAwarded != null ? ` · ${latest.marksAwarded} marks` : ''}.
        {latest?.feedbackText ? ` ${latest.feedbackText}` : ''}
      </p>
    );
  }
  if (!canSubmit) return null;

  return (
    <div className="grid gap-2 rounded-lg border border-dashed p-3">
      {sub?.status === 'RETURNED' ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Revision requested: {sub.feedback?.[0]?.feedbackText ?? 'Please resubmit.'}
        </p>
      ) : null}
      {['TEXT', 'MIXED'].includes(assignment.submissionType) ? (
        <textarea
          placeholder="Your answer…"
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={submitText}
          onChange={(e) => setSubmitText(e.target.value)}
          rows={3}
        />
      ) : null}
      {['LINK', 'MIXED'].includes(assignment.submissionType) ? (
        <Input
          placeholder="Link URL"
          value={submitLink}
          onChange={(e) => setSubmitLink(e.target.value)}
        />
      ) : null}
      {['FILE', 'MIXED'].includes(assignment.submissionType) ? (
        <Input type="file" onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)} />
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => onSubmit({ textContent: submitText, linkUrl: submitLink, file: submitFile })}
      >
        {sub?.status === 'RETURNED' ? 'Resubmit' : 'Submit'}
      </Button>
    </div>
  );
}
