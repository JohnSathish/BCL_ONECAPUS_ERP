'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalAttendanceControl } from '@/services/principal-desk';

export default function AttendancePage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'attendance'],
    queryFn: fetchPrincipalAttendanceControl,
    enabled,
  });

  return (
    <PrincipalDeskShell title="Attendance Control Center" subtitle="Live college-wide attendance">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Student %" value={`${data.overall.studentAttendancePct}%`} />
            <Stat label="Staff %" value={`${data.overall.staffAttendancePct}%`} />
            <Stat label="Students Present" value={String(data.overall.studentsPresent)} />
            <Stat label="Staff Present" value={String(data.overall.staffPresent)} />
          </div>
          <SaaSCard>
            <SectionTitle title="Top Attendance Shortage" />
            {data.topShortage?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2">Student</th>
                      <th>Semester</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topShortage.slice(0, 15).map((row: Record<string, unknown>) => (
                      <tr key={String(row.id)} className="border-b border-slate-100">
                        <td className="py-2 font-mono text-xs">
                          {String(row.studentId).slice(0, 8)}…
                        </td>
                        <td>{String(row.semesterNo ?? '—')}</td>
                        <td className="font-bold text-rose-600">{String(row.percentage)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No shortage records</p>
            )}
          </SaaSCard>
        </div>
      ) : null}
    </PrincipalDeskShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <SaaSCard>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-indigo-600">{value}</p>
    </SaaSCard>
  );
}
