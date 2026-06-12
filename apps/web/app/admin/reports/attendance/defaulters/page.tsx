'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentAttendanceReport } from '@/services/student-attendance';

export default function AttendanceDefaultersReportPage() {
  const session = useRequireAuth();

  const report = useQuery({
    queryKey: ['reports', 'attendance-defaulters'],
    queryFn: () => fetchStudentAttendanceReport('defaulters'),
    enabled: Boolean(session),
  });

  if (!session) return null;

  const rows = (report.data ?? []) as Array<{
    id: string;
    studentId?: string;
    subjectPercentage?: number;
    eligibilityStatus?: string;
    shortageSessions?: number;
  }>;

  return (
    <DashboardShell role="admin" title="Attendance Defaulters">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Students in condonation or detention eligibility based on FYUGP attendance rules.
        </p>
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Subject %</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.studentId?.slice(0, 8) ?? '—'}…
                  </td>
                  <td className="px-3 py-2">{row.subjectPercentage ?? '—'}%</td>
                  <td className="px-3 py-2">{row.eligibilityStatus ?? '—'}</td>
                  <td className="px-3 py-2">{row.shortageSessions ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.isLoading && rows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              No defaulter snapshots found. Run eligibility recalculation first.
            </p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
