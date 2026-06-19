'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Users } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { exportStudentsCsv, exportStudentsProfileXlsx, fetchStudents } from '@/services/students';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdmissionRegisterReportPage() {
  const session = useRequireAuth();
  const [search, setSearch] = useState('');

  const students = useQuery({
    queryKey: ['reports', 'admission-register', search],
    queryFn: () => fetchStudents({ limit: 100, search: search || undefined }),
    enabled: Boolean(session),
  });

  const exportCsv = useMutation({
    mutationFn: () => exportStudentsCsv({ search: search || undefined }),
    onSuccess: (blob) => downloadBlob(blob, 'admission_register.csv'),
  });

  const exportXlsx = useMutation({
    mutationFn: () => exportStudentsProfileXlsx({ search: search || undefined }),
    onSuccess: (blob) => downloadBlob(blob, 'admission_register.xlsx'),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Admission Register">
      <div className="space-y-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Live admission register with export to CSV or Excel profile workbook.
        </p>

        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-sm"
            placeholder="Filter by name or enrollment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" disabled={exportXlsx.isPending} onClick={() => exportXlsx.mutate()}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>

        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Enrollment</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Programme</th>
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(students.data?.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2">{row.enrollmentNumber}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.programme ?? '—'}</td>
                  <td className="px-3 py-2">{row.batch ?? '—'}</td>
                  <td className="px-3 py-2">{row.academicStatus ?? row.admissionStatus ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!students.isLoading && !(students.data?.data ?? []).length ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              No students match this filter.
            </p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
