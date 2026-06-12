'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import {
  StudentFilterBar,
  type StudentFilters,
} from '@/components/student-records/student-filter-bar';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { bulkAssignRfid, fetchStudentProfile, fetchStudents } from '@/services/students';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';

const emptyFilters: StudentFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: '',
};

export default function StudentRfidPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<StudentFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [message, setMessage] = useState('');

  const students = useQuery({
    queryKey: ['students', 'rfid', filters],
    queryFn: () =>
      fetchStudents({
        limit: 50,
        search: filters.search || undefined,
      }),
    enabled: Boolean(session),
  });

  const profile = useQuery({
    queryKey: ['students', selectedId, 'profile'],
    queryFn: () => fetchStudentProfile(selectedId),
    enabled: Boolean(session) && Boolean(selectedId),
  });

  const bulkMut = useMutation({
    mutationFn: () => {
      const assignments: Record<string, string> = {};
      for (const line of bulkText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [studentId, rfid] = trimmed.split(/[,\t]/).map((s) => s.trim());
        if (studentId && rfid) assignments[studentId] = rfid;
      }
      if (Object.keys(assignments).length === 0) {
        throw new Error('Enter at least one studentId,rfid pair');
      }
      return bulkAssignRfid(assignments);
    },
    onSuccess: (result) => {
      setMessage(`Updated ${result.updated} RFID assignment(s).`);
      setBulkText('');
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk RFID assignment failed')),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="RFID">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assign and review RFID card numbers. Use bulk assign for many students at once, or edit
          individually from the student profile.
        </p>

        {message ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{message}</p>
        ) : null}

        <CompactCard>
          <CompactCardHeader
            title="Bulk assign"
            description="One pair per line: studentId,rfidNumber (comma or tab separated)"
          />
          <CompactCardBody className="space-y-3">
            <textarea
              className="min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-xs"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'uuid-1,RFID001\nuuid-2,RFID002'}
            />
            <Button
              type="button"
              size="sm"
              disabled={!perms.canManage || bulkMut.isPending}
              onClick={() => bulkMut.mutate()}
            >
              {bulkMut.isPending ? 'Assigning…' : 'Bulk assign RFID'}
            </Button>
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Find student"
            description="Search by registration number or name, then open profile to edit RFID"
          />
          <CompactCardBody className="space-y-3">
            <StudentFilterBar
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              programOptions={[]}
              shiftOptions={[]}
              batchOptions={[]}
              streamOptions={[]}
            />
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {(students.data?.data ?? []).slice(0, 20).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {row.enrollmentNumber} — {row.fullName}
                  </span>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setSelectedId(row.id)}
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
            {selectedId ? (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Student ID: </span>
                  <span className="font-mono text-xs">{selectedId}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">RFID: </span>
                  {profile.data?.rfidNumber ?? 'Not assigned'}
                </p>
                <Link
                  href={`/admin/students/${selectedId}?section=basic`}
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-2')}
                >
                  Edit in profile
                </Link>
              </div>
            ) : null}
          </CompactCardBody>
        </CompactCard>
      </div>
    </DashboardShell>
  );
}
