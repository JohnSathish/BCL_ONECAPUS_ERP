'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchStaffProfile } from '@/services/staff';

export default function StaffWorkloadPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Staff Workload">
          <div />
        </DashboardShell>
      }
    >
      <StaffWorkloadPageContent />
    </Suspense>
  );
}

function StaffWorkloadPageContent() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const searchParams = useSearchParams();
  const staffId = searchParams.get('staff') ?? '';

  const profile = useQuery({
    queryKey: ['staff', staffId, 'profile'],
    queryFn: () => fetchStaffProfile(staffId),
    enabled: Boolean(session) && Boolean(staffId) && perms.canRead,
  });

  if (!session) return null;

  const workloads = profile.data?.workloads ?? [];
  const assignments = profile.data?.subjectAssignments ?? [];

  return (
    <DashboardShell role="admin" title="Staff Workload">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Teaching workload hours and timetable section counts. Select a staff member from their
          profile or assignments page.
        </p>

        {staffId && profile.data ? (
          <>
            <CompactCard>
              <CompactCardHeader
                title={profile.data.fullName}
                description={`${assignments.length} subject assignments · ${profile.data.timetableSections ?? 0} timetable sections`}
              />
              <CompactCardBody className="overflow-x-auto">
                {workloads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workload records yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 pr-2">Academic year</th>
                        <th className="py-2">Total hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloads.map((w) => (
                        <tr key={w.id} className="border-b border-border/60">
                          <td className="py-2 pr-2">{w.academicYear?.name ?? '—'}</td>
                          <td className="py-2">{w.totalHours ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CompactCardBody>
            </CompactCard>

            <CompactCard>
              <CompactCardHeader title="Subject load" description="Assigned courses by semester" />
              <CompactCardBody>
                <ul className="divide-y divide-border text-sm">
                  {assignments.map((a) => (
                    <li key={a.id} className="py-2">
                      Sem {a.semesterNo}: {a.course?.code} — {a.course?.title}
                      {a.workloadHours != null ? ` (${a.workloadHours}h)` : ''}
                    </li>
                  ))}
                </ul>
              </CompactCardBody>
            </CompactCard>
          </>
        ) : (
          <CompactCard>
            <CompactCardBody>
              <p className="text-sm text-muted-foreground">
                Open a staff profile and use the Timetable tab, or append{' '}
                <code className="rounded bg-muted px-1">?staff=&lt;id&gt;</code> to this URL.
              </p>
            </CompactCardBody>
          </CompactCard>
        )}

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
