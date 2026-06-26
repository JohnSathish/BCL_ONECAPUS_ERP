'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  applyPromotionRun,
  createPromotionRun,
  previewPromotion,
  previewPromotionMappings,
  validatePromotion,
} from '@/services/academic-lifecycle';
import type {
  PromotionMappingPreviewStudent,
  PromotionPreviewResponse,
  PromotionValidateResponse,
} from '@/types/academic-lifecycle';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  institutionId: string;
  campusId?: string;
  shiftId?: string;
  admissionBatchId?: string;
  defaultFromSequence?: number;
  canManage: boolean;
  onApplied?: () => void;
};

const STEPS = [
  'Select promotion',
  'Eligibility preview',
  'Subject mapping',
  'Validation',
  'Apply',
] as const;

export function PromotionWizard({
  institutionId,
  campusId,
  shiftId,
  admissionBatchId,
  defaultFromSequence = 1,
  canManage,
  onApplied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [fromSequence, setFromSequence] = useState(defaultFromSequence);
  const [message, setMessage] = useState('');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const toSequence = fromSequence + 1;

  const scope = {
    institutionId,
    fromSequence,
    toSequence,
    campusId: campusId || undefined,
    shiftId: shiftId || undefined,
    admissionBatchId: admissionBatchId || undefined,
  };

  const eligibility = useQuery({
    queryKey: ['promotion-wizard', 'preview', scope],
    queryFn: () => previewPromotion(scope),
    enabled: open && Boolean(institutionId) && step >= 1,
  });

  const mappings = useQuery({
    queryKey: ['promotion-wizard', 'mappings', scope],
    queryFn: () => previewPromotionMappings(scope),
    enabled: open && Boolean(institutionId) && step >= 2,
  });

  const validation = useQuery({
    queryKey: ['promotion-wizard', 'validate', scope],
    queryFn: () => validatePromotion(scope),
    enabled: open && Boolean(institutionId) && step >= 3,
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      const run = await createPromotionRun({ ...scope, trigger: 'MANUAL' });
      const runId = (run as { id: string }).id;
      return applyPromotionRun(runId);
    },
    onSuccess: () => {
      setMessage(
        'Promotion applied — semester standing updated and subject registrations regenerated.',
      );
      onApplied?.();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Promotion failed')),
  });

  const preview = eligibility.data as PromotionPreviewResponse | undefined;
  const mappingRows = (mappings.data ?? []) as PromotionMappingPreviewStudent[];
  const validationResult = validation.data as PromotionValidateResponse | undefined;

  const eligibleCount = preview?.counts.eligible ?? 0;
  const blockedCount = (preview?.counts.detained ?? 0) + (preview?.counts.failed ?? 0);

  const sampleStudent = useMemo(
    () => mappingRows.find((s) => s.lines.length > 0) ?? mappingRows[0],
    [mappingRows],
  );

  const reset = () => {
    setStep(0);
    setMessage('');
    setExpandedStudentId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Semester promotion wizard</CardTitle>
        <CardDescription>
          Promote students, preview subject mappings from curriculum, and regenerate registrations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide wizard' : 'Open promotion wizard'}
        </Button>

        {open ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {STEPS.map((label, index) => (
                <span
                  key={label}
                  className={
                    index === step
                      ? 'rounded-full bg-primary/10 px-2 py-1 font-medium text-primary'
                      : 'rounded-full border border-border px-2 py-1'
                  }
                >
                  {index + 1}. {label}
                </span>
              ))}
            </div>

            {message ? (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {message}
              </p>
            ) : null}

            {step === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  Current semester
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3"
                    value={fromSequence}
                    onChange={(e) => setFromSequence(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        Semester {n}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2 text-sm">
                  <span className="text-muted-foreground">Promote to</span>
                  <p className="text-lg font-semibold">Semester {toSequence}</p>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              eligibility.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading eligibility…</p>
              ) : preview ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Eligible" value={eligibleCount} />
                  <Stat label="Blocked" value={blockedCount} />
                  <Stat label="Total" value={preview.counts.total} />
                </div>
              ) : (
                <p className="text-sm text-destructive">Could not load eligibility preview.</p>
              )
            ) : null}

            {step === 2 ? (
              mappings.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading subject mappings…</p>
              ) : mappingRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students in scope.</p>
              ) : (
                <div className="space-y-3">
                  {sampleStudent ? (
                    <MappingCard
                      student={sampleStudent}
                      expanded={expandedStudentId === sampleStudent.studentId}
                      onToggle={() =>
                        setExpandedStudentId((id) =>
                          id === sampleStudent.studentId ? null : sampleStudent.studentId,
                        )
                      }
                    />
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Showing sample of {mappingRows.length} student
                    {mappingRows.length === 1 ? '' : 's'}. Expand to verify paper transitions.
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                    {mappingRows.slice(0, 20).map((student) => (
                      <MappingCard
                        key={student.studentId}
                        student={student}
                        compact
                        expanded={expandedStudentId === student.studentId}
                        onToggle={() =>
                          setExpandedStudentId((id) =>
                            id === student.studentId ? null : student.studentId,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )
            ) : null}

            {step === 3 ? (
              validation.isLoading ? (
                <p className="text-sm text-muted-foreground">Running validation…</p>
              ) : validationResult ? (
                <div className="space-y-2 text-sm">
                  <p>
                    Status:{' '}
                    <span
                      className={
                        validationResult.valid
                          ? 'font-medium text-green-700'
                          : 'font-medium text-destructive'
                      }
                    >
                      {validationResult.valid ? 'Ready to promote' : 'Blocked'}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {validationResult.counts.valid} valid · {validationResult.counts.blocked}{' '}
                    blocked · {validationResult.counts.total} total
                  </p>
                  {!validationResult.valid ? (
                    <ul className="list-disc space-y-1 pl-5 text-destructive">
                      {validationResult.students
                        .filter((s) => !s.valid)
                        .slice(0, 5)
                        .map((s) => (
                          <li key={s.studentId}>
                            {s.enrollmentNumber ?? s.studentId}: {s.messages.join('; ')}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ) : null
            ) : null}

            {step === 4 ? (
              <div className="space-y-2 text-sm">
                <p>
                  Promote <span className="font-medium">{eligibleCount}</span> students from Sem{' '}
                  {fromSequence} to Sem {toSequence}.
                </p>
                <p className="text-muted-foreground">
                  This will update standing, archive prior registrations, and regenerate target
                  semester subjects from curriculum mapping.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </Button>
              ) : null}
              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={step === 1 && eligibility.isLoading}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canManage || applyMut.isPending || validationResult?.valid === false}
                  onClick={() => applyMut.mutate()}
                >
                  {applyMut.isPending ? 'Promoting…' : 'Promote now'}
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function MappingCard({
  student,
  expanded,
  onToggle,
  compact = false,
}: {
  student: PromotionMappingPreviewStudent;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
        onClick={onToggle}
      >
        <span>
          <span className="font-medium">
            {student.studentName || student.enrollmentNumber || student.studentId}
          </span>
          {!student.valid ? <span className="ml-2 text-destructive">· mapping issues</span> : null}
        </span>
        <span className="text-muted-foreground">{expanded ? '−' : '+'}</span>
      </button>
      {expanded ? (
        <div className="space-y-2 border-t border-border px-3 py-2 text-xs">
          {student.lines.map((line) => (
            <div
              key={`${line.category}-${line.to.offeringId}`}
              className="grid gap-1 sm:grid-cols-3"
            >
              <span className="font-medium">
                {line.category}
                {line.departmentName ? ` (${line.departmentName})` : ''}
              </span>
              <span className="text-muted-foreground">{line.from ? `${line.from.code}` : '—'}</span>
              <span>
                → {line.to.code}
                {!compact ? ` · ${line.to.title}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
