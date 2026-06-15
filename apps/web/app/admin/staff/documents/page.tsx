'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import {
  fetchStaff,
  fetchStaffDocumentsExpiringReport,
  fetchStaffDocumentsMissingReport,
  fetchStaffDocumentsPendingReport,
} from '@/services/staff';
import { formatDisplayDate } from '@/utils/format-date';

export default function StaffDocumentsPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();

  const staffList = useQuery({
    queryKey: ['staff', 'documents-index'],
    queryFn: () => fetchStaff({ limit: 100 }),
    enabled: Boolean(session) && perms.canRead,
  });

  const missingQ = useQuery({
    queryKey: ['staff', 'documents', 'reports', 'missing'],
    queryFn: fetchStaffDocumentsMissingReport,
    enabled: Boolean(session) && perms.canRead,
  });

  const expiringQ = useQuery({
    queryKey: ['staff', 'documents', 'reports', 'expiring'],
    queryFn: fetchStaffDocumentsExpiringReport,
    enabled: Boolean(session) && perms.canRead,
  });

  const pendingQ = useQuery({
    queryKey: ['staff', 'documents', 'reports', 'pending'],
    queryFn: fetchStaffDocumentsPendingReport,
    enabled: Boolean(session) && perms.canRead,
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Staff Documents">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Document compliance across staff records. Upload and verify documents from each staff
          profile.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          <CompactCard>
            <CompactCardHeader
              title="Missing Documents"
              description="Staff with incomplete document sets"
            />
            <CompactCardBody>
              {!missingQ.data?.length ? (
                <p className="text-sm text-muted-foreground">
                  All active staff have complete document sets.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                  {missingQ.data.slice(0, 20).map((row) => (
                    <li key={row.staffProfileId} className="rounded border px-2 py-1.5">
                      <Link
                        href={`/admin/staff/${row.staffProfileId}?tab=documents`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.fullName} ({row.employeeCode})
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {row.missingCount} missing · {row.complianceScore}% compliance
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader
              title="Expiring Soon"
              description="Documents expiring within 30 days"
            />
            <CompactCardBody>
              {!expiringQ.data?.length ? (
                <p className="text-sm text-muted-foreground">No documents expiring soon.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                  {expiringQ.data.map((row, i) => (
                    <li
                      key={`${row.staffProfileId}-${row.documentType}-${i}`}
                      className="rounded border px-2 py-1.5"
                    >
                      <Link
                        href={`/admin/staff/${row.staffProfileId}?tab=documents`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.fullName}
                      </Link>
                      <p className="text-xs">{row.documentLabel}</p>
                      <p className="text-xs text-amber-700">
                        Expires {row.expiryDate ? formatDisplayDate(row.expiryDate) : '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CompactCardBody>
          </CompactCard>

          <CompactCard>
            <CompactCardHeader title="Pending Verification" description="Awaiting HR review" />
            <CompactCardBody>
              {!pendingQ.data?.length ? (
                <p className="text-sm text-muted-foreground">No documents pending verification.</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-auto text-sm">
                  {pendingQ.data.map((row) => (
                    <li key={row.documentId} className="rounded border px-2 py-1.5">
                      <Link
                        href={`/admin/staff/${row.staffProfileId}?tab=documents`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.fullName}
                      </Link>
                      <p className="text-xs">{row.documentLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {formatDisplayDate(row.uploadedOn)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CompactCardBody>
          </CompactCard>
        </div>

        <CompactCard>
          <CompactCardHeader
            title="Staff records"
            description="Open profile documents tab to manage files"
          />
          <CompactCardBody>
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {(staffList.data?.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {row.employeeCode} — {row.fullName}
                  </span>
                  <Link
                    href={`/admin/staff/${row.id}?tab=documents`}
                    className="text-primary hover:underline"
                  >
                    Documents
                  </Link>
                </li>
              ))}
            </ul>
          </CompactCardBody>
        </CompactCard>

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
