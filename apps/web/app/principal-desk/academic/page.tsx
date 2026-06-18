'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalDashboard } from '@/services/principal-desk';

export default function AcademicPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
  });

  return (
    <PrincipalDeskShell title="Academic Monitor" subtitle="Classes, faculty engagement, trends">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SaaSCard>
            <SectionTitle title="Classes Scheduled" />
            <p className="text-3xl font-black">{data.academic.classesScheduled}</p>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Classes Conducted" />
            <p className="text-3xl font-black text-emerald-600">{data.academic.classesCompleted}</p>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Faculty Attendance" />
            <p className="text-3xl font-black text-indigo-600">
              {data.academic.facultyAttendancePct}%
            </p>
          </SaaSCard>
          <SaaSCard className="sm:col-span-2 lg:col-span-3">
            <SectionTitle title="Student Attendance Trend" />
            <p className="text-sm text-slate-600">
              Overall student attendance today:{' '}
              <strong>{data.academic.studentAttendancePct}%</strong> ·{' '}
              {data.academic.studentsPresent} present, {data.academic.studentsAbsent} absent
            </p>
          </SaaSCard>
        </div>
      ) : null}
    </PrincipalDeskShell>
  );
}
