'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { createStudentRemark, fetchStudentRemarks, fetchStudents } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { formatShortDate } from '@/utils/format-date';

const REMARK_TYPES = ['GENERAL', 'DISCIPLINARY', 'ACADEMIC', 'FEES', 'ADMIN'];

export default function StudentCommunicationPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [remarkType, setRemarkType] = useState('GENERAL');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('INTERNAL');
  const [message, setMessage] = useState('');

  const students = useQuery({
    queryKey: ['students', 'communication', search],
    queryFn: () => fetchStudents({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const remarks = useQuery({
    queryKey: ['students', selectedId, 'remarks'],
    queryFn: () => fetchStudentRemarks(selectedId),
    enabled: Boolean(session) && Boolean(selectedId) && perms.canRead,
  });

  const selected = (students.data?.data ?? []).find((s) => s.id === selectedId);

  const createMut = useMutation({
    mutationFn: () =>
      createStudentRemark(selectedId, {
        remarkType,
        body,
        visibility,
      }),
    onSuccess: () => {
      setMessage('Remark added.');
      setBody('');
      void qc.invalidateQueries({ queryKey: ['students', selectedId, 'remarks'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not add remark')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Communication">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Internal remarks and notes for student records. Remarks are visible to staff with student
          read access.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <CompactCard>
          <CompactCardHeader
            title="Select student"
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

        {selectedId ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <CompactCard>
              <CompactCardHeader
                title="Add remark"
                description={
                  selected ? `${selected.enrollmentNumber} · ${selected.fullName}` : undefined
                }
              />
              <CompactCardBody className="space-y-3">
                <label className="block space-y-1 text-sm">
                  Type
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={remarkType}
                    onChange={(e) => setRemarkType(e.target.value)}
                  >
                    {REMARK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  Visibility
                  <select
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="INTERNAL">Internal (staff only)</option>
                    <option value="STUDENT">Visible to student</option>
                  </select>
                </label>
                <label className="block space-y-1 text-sm">
                  Remark
                  <textarea
                    className="min-h-[100px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Enter remark text…"
                  />
                </label>
                <Button
                  type="button"
                  disabled={!body.trim() || !perms.canManage || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? 'Saving…' : 'Add remark'}
                </Button>
              </CompactCardBody>
            </CompactCard>

            <CompactCard>
              <CompactCardHeader title="Remarks history" />
              <CompactCardBody>
                {remarks.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (remarks.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No remarks yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {(remarks.data ?? []).map((r) => (
                      <li key={r.id} className="rounded-md border border-border px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{r.remarkType}</span>
                          <span>{formatShortDate(r.createdAt)}</span>
                          <span>{r.visibility}</span>
                          {r.actor?.email ? <span>{r.actor.email}</span> : null}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CompactCardBody>
            </CompactCard>
          </div>
        ) : (
          <CompactCard>
            <CompactCardHeader title="Remarks" />
            <CompactCardBody>
              <p className="text-sm text-muted-foreground">
                Select a student to view and add remarks.
              </p>
            </CompactCardBody>
          </CompactCard>
        )}

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
