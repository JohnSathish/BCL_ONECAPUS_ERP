'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { createLifecycleEvent, fetchStudents } from '@/services/students';
import { todayIsoDate } from '@/utils/format-date';
import { apiErrorMessage } from '@/utils/api-error';

export default function StudentReadmissionPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => todayIsoDate());
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const students = useQuery({
    queryKey: ['students', 'readmission', search],
    queryFn: () => fetchStudents({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const selected = (students.data?.data ?? []).find((s) => s.id === selectedId);

  const submitMut = useMutation({
    mutationFn: () =>
      createLifecycleEvent({
        studentId: selectedId,
        eventType: 'READMISSION',
        effectiveDate,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      setMessage('Readmission event recorded. Student status restored to studying.');
      setReason('');
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Readmission failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Readmission">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Record a readmission lifecycle event to reactivate a student who left or dropped out.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <CompactCard>
          <CompactCardHeader
            title="Find student"
            description="Search by enrollment number or name"
          />
          <CompactCardBody className="space-y-3">
            <Input
              placeholder="Type at least 2 characters…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedId('');
              }}
            />
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {(students.data?.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {row.enrollmentNumber} — {row.fullName}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({row.academicStatus})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setSelectedId(row.id)}
                  >
                    {selectedId === row.id ? 'Selected' : 'Select'}
                  </button>
                </li>
              ))}
            </ul>
          </CompactCardBody>
        </CompactCard>

        {selectedId && submitMut.isSuccess ? (
          <CompactCard>
            <CompactCardBody className="space-y-2 text-sm">
              <p className="font-medium">Next steps</p>
              <p className="text-muted-foreground">
                Generate compulsory subjects or import finalized electives for this student.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/students/subject-registration?student=${selectedId}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Open subject registration
                </Link>
              </div>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        {selectedId && !submitMut.isSuccess ? (
          <CompactCard>
            <CompactCardHeader
              title="Readmission details"
              description={
                selected
                  ? `${selected.enrollmentNumber} · ${selected.fullName}`
                  : 'Selected student'
              }
            />
            <CompactCardBody className="space-y-3">
              <label className="block space-y-1 text-sm">
                Effective date
                <DateInput value={effectiveDate} onChange={setEffectiveDate} />
              </label>
              <label className="block space-y-1 text-sm">
                Reason (optional)
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Returned after medical leave"
                />
              </label>
              <Button
                type="button"
                disabled={!perms.canManage || submitMut.isPending}
                onClick={() => submitMut.mutate()}
              >
                {submitMut.isPending ? 'Submitting…' : 'Create readmission event'}
              </Button>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        <Link
          href="/admin/students"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          ← Back to Student Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
