'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { fetchStudentAuditLogs, fetchStudents } from '@/services/students';
import { formatShortDate } from '@/utils/format-date';

export default function StudentAuditPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const students = useQuery({
    queryKey: ['students', 'audit-search', search],
    queryFn: () => fetchStudents({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const auditLogs = useQuery({
    queryKey: ['students', 'audit-logs', selectedId],
    queryFn: () => fetchStudentAuditLogs(selectedId || undefined),
    enabled: Boolean(session) && perms.canRead,
  });

  if (!session) return null;

  const rows = auditLogs.data ?? [];

  return (
    <DashboardShell role="admin" title="Audit Log">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Profile field changes across student records. Filter by student or view all recent
          changes.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Filter by student"
            description="Optional — leave unselected to show all audit entries"
          />
          <CompactCardBody className="space-y-3">
            <Input
              placeholder="Search student (optional)…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setSelectedId('');
              }}
            />
            {search.length >= 2 ? (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                <li className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-muted-foreground">All students</span>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setSelectedId('')}
                  >
                    {!selectedId ? 'Selected' : 'Select'}
                  </button>
                </li>
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
            ) : null}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Audit entries"
            description={`${rows.length} record${rows.length === 1 ? '' : 's'}`}
          />
          <CompactCardBody className="overflow-x-auto">
            {auditLogs.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading audit logs…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Student</th>
                    <th className="py-2 pr-2">Section</th>
                    <th className="py-2 pr-2">Field</th>
                    <th className="py-2 pr-2">Old</th>
                    <th className="py-2 pr-2">New</th>
                    <th className="py-2">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {formatShortDate(log.createdAt)}
                      </td>
                      <td className="py-2 pr-2">
                        {log.student?.enrollmentNumber ?? log.studentId.slice(0, 8)}
                        {log.student?.masterProfile?.fullName
                          ? ` · ${log.student.masterProfile.fullName}`
                          : ''}
                      </td>
                      <td className="py-2 pr-2">{log.sectionKey}</td>
                      <td className="py-2 pr-2">{log.fieldKey}</td>
                      <td className="max-w-[120px] truncate py-2 pr-2 text-muted-foreground">
                        {log.oldValue ?? '—'}
                      </td>
                      <td className="max-w-[120px] truncate py-2 pr-2">{log.newValue ?? '—'}</td>
                      <td className="py-2">{log.actor?.email ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CompactCardBody>
        </CompactCard>

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
