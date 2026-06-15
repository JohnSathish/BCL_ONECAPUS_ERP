'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { fetchSubstituteStaffDetail } from '@/services/hr-substitute';
import { useRequireAuth } from '@/hooks/use-auth';
import { formatDisplayDate } from '@/utils/format-date';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = useRequireAuth();
  const { id } = use(params);
  const detail = useQuery({
    queryKey: ['hr', 'substitute', 'staff', id],
    queryFn: () => fetchSubstituteStaffDetail(id),
    enabled: !!session,
  });

  if (!session) return null;
  const row = detail.data;

  return (
    <DashboardShell role="admin" title={row?.fullName ?? 'Substitute Profile'}>
      <div className="space-y-4">
        <Link href="/admin/hr/substitute-staff" className="text-sm text-primary hover:underline">
          ← Back to Substitute Staff
        </Link>
        {detail.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {row ? (
          <>
            <GlassCard className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Code</p>
                <p className="font-mono font-medium">{row.substituteCode}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium">{row.department ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium">{row.category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-medium">{row.status}</p>
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Assignment History</h3>
              <div className="space-y-2 text-sm">
                {(row.assignments ?? []).map((assignment) => (
                  <div key={assignment.id} className="rounded-lg border p-3">
                    <div className="font-medium">{assignment.originalStaff.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {assignment.reasonLabel} · {formatDisplayDate(assignment.startDate)} –{' '}
                      {formatDisplayDate(assignment.endDate)} · {assignment.status}
                    </div>
                  </div>
                ))}
                {!row.assignments?.length ? (
                  <p className="text-muted-foreground">No assignments yet.</p>
                ) : null}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Documents</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {(row.documents as Array<{ documentType: string; status: string }>).map((doc) => (
                  <div
                    key={doc.documentType}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <span>{doc.documentType.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">{doc.status}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
