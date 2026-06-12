'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchDepartments, fetchFacultyForHod } from '@/services/organization';

function hodCandidateLabel(f: {
  employeeCode: string;
  fullName?: string | null;
  portalUser?: { email: string } | null;
  user?: { email: string } | null;
}) {
  return `${f.employeeCode} — ${f.portalUser?.email ?? f.user?.email ?? f.fullName ?? 'No portal email'}`;
}

export default function StaffDepartmentsPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();

  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: Boolean(session),
  });

  const hodOptions = useQuery({
    queryKey: ['org', 'faculty-hod'],
    queryFn: () => fetchFacultyForHod(),
    enabled: Boolean(session),
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Departments & HoD">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Department structure and Head of Department allocation. Manage department records in
          Organization settings.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Departments"
            description={`${departments.data?.length ?? 0} departments`}
          />
          <CompactCardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(departments.data ?? []).map((d) => (
                  <tr key={d.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-mono text-xs">{d.code ?? '—'}</td>
                    <td className="py-2 pr-2">{d.name}</td>
                    <td className="py-2 pr-2">{d.departmentType ?? '—'}</td>
                    <td className="py-2">{d.status ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CompactCardBody>
        </CompactCard>

        {perms.canManage ? (
          <CompactCard>
            <CompactCardHeader
              title="HoD candidates"
              description="Staff eligible for Head of Department assignment"
            />
            <CompactCardBody>
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {(hodOptions.data ?? []).slice(0, 20).map((f) => (
                  <li key={f.id} className="px-3 py-2">
                    {hodCandidateLabel(f)}
                  </li>
                ))}
              </ul>
              <Link
                href="/admin/organization"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Manage in Organization →
              </Link>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
